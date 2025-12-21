import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, logSelfHealing, upsertKnowledge } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  return handleProcessQueue(request);
}

export async function POST(request: NextRequest) {
  return handleProcessQueue(request);
}

async function handleProcessQueue(request: NextRequest) {
  const startTime = Date.now();
  let processed = 0;
  let errors = 0;
  const batchSize = 50;

  try {
    console.log('🧠 Learning queue processor started');

    const { data: items, error } = await supabase
      .from('javari_learning_queue')
      .select('*')
      .eq('processed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(`Failed to fetch queue: ${error.message}`);
    }

    if (!items || items.length === 0) {
      console.log('✅ Queue is empty');
      return NextResponse.json({
        success: true,
        message: 'Queue is empty',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`Processing ${items.length} items`);

    for (const item of items) {
      try {
        const result = await processLearningItem(item);
        
        await supabase
          .from('javari_learning_queue')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            learning_outcome: result,
          })
          .eq('id', item.id);

        processed++;
        
      } catch (error) {
        errors++;
        console.error(`Error processing item ${item.id}:`, error);
        
        await supabase
          .from('javari_learning_queue')
          .update({
            learning_outcome: {
              error: error instanceof Error ? error.message : 'Unknown error',
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', item.id);
      }
    }

    const duration = Date.now() - startTime;

    await logActivity(
      'process_learning_queue',
      'javari-autonomous-system',
      { batch_size: items.length, processed, errors },
      errors === 0,
      errors > 0 ? `${errors} items failed` : undefined,
      duration
    );

    const { count: remaining } = await supabase
      .from('javari_learning_queue')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      processed,
      errors,
      remaining_in_queue: remaining || 0,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Queue processor error:', error);

    await logSelfHealing({
      component: 'learning-queue',
      issue_type: 'processor_failed',
      issue_description: errorMsg,
      severity: 'high',
      auto_healed: false,
      requires_human: true,
      notified: false,
    });

    return NextResponse.json({
      success: false,
      error: errorMsg,
      processed,
      errors,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function processLearningItem(item: {
  id: string;
  source: string;
  content_type: string;
  raw_content: string;
}): Promise<Record<string, unknown>> {
  const content = JSON.parse(item.raw_content);
  
  switch (item.content_type) {
    case 'documentation':
      return await processDocumentation(item.source, content);
    case 'tutorial':
    case 'curriculum':
      return await processTutorial(item.source, content);
    case 'news':
      return await processNews(item.source, content);
    case 'documentation_section':
      return { action: 'section_logged', section: content.section };
    default:
      return { action: 'stored', type: item.content_type };
  }
}

async function processDocumentation(
  source: string,
  content: { doc?: string; title?: string; type?: string; url?: string }
): Promise<Record<string, unknown>> {
  const category = mapSourceToCategory(source, content.doc);
  
  await upsertKnowledge({
    category,
    topic: `${source}:${content.doc}:${content.title}`,
    question: `How to use ${content.title} in ${content.doc}?`,
    answer: `Documentation reference for ${content.title} (${content.type}) in ${content.doc}. See: ${content.url}`,
    short_answer: `${content.title} - ${content.type}`,
    source: source,
    source_url: content.url,
    confidence_score: 0.9,
    keywords: extractKeywords(content.title || '', content.type || ''),
    is_active: true,
  });

  return { action: 'knowledge_created', category, topic: content.title };
}

async function processTutorial(
  source: string,
  content: { name?: string; curriculum?: string; section?: string; url?: string; type?: string }
): Promise<Record<string, unknown>> {
  await upsertKnowledge({
    category: 'tutorials',
    topic: `${source}:${content.curriculum || content.name}:${content.section || ''}`,
    question: `What is taught in ${content.name || content.section}?`,
    answer: `Tutorial from ${source}: ${content.name || content.section}. Type: ${content.type}. See: ${content.url}`,
    short_answer: content.name || content.section || 'Tutorial',
    source: source,
    source_url: content.url,
    confidence_score: 0.85,
    keywords: extractKeywords(content.name || '', content.curriculum || ''),
    is_active: true,
  });

  return { action: 'tutorial_indexed', curriculum: content.curriculum };
}

async function processNews(
  source: string,
  content: { title?: string; url?: string; score?: number }
): Promise<Record<string, unknown>> {
  await supabase.from('javari_external_data').upsert({
    source,
    data_type: 'news',
    content: content,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'source,data_type' });

  return { action: 'news_stored', title: content.title };
}

function mapSourceToCategory(source: string, doc?: string): string {
  const docLower = (doc || '').toLowerCase();
  if (docLower.includes('react')) return 'react';
  if (docLower.includes('typescript') || docLower.includes('javascript')) return 'javascript';
  if (docLower.includes('node')) return 'nodejs';
  if (docLower.includes('next')) return 'nextjs';
  if (docLower.includes('css') || docLower.includes('tailwind')) return 'css';
  if (docLower.includes('html') || docLower.includes('dom')) return 'html';
  if (docLower.includes('postgre') || docLower.includes('sql')) return 'database';
  if (docLower.includes('python')) return 'python';
  return 'programming';
}

function extractKeywords(...texts: string[]): string[] {
  const combined = texts.join(' ').toLowerCase();
  const words = combined.split(/[\s\-_.,()[\]{}]+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its']);
  return [...new Set(words)].filter(w => w.length > 2 && !stopWords.has(w)).slice(0, 10);
}
