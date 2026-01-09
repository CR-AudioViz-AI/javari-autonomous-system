import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface IngestPayload {
  source_type: 'chat' | 'repo' | 'doc' | 'api' | 'web' | 'manual';
  source_name: string;
  source_url?: string;
  license_or_tos_url?: string;
  content_type: string;
  raw_content: unknown;
  tags?: string[];
  category?: string;
}

function normalizeText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (typeof content === 'object') return JSON.stringify(content);
  return String(content);
}

function generateHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const payload: IngestPayload = await request.json();
    
    // Validate required fields
    if (!payload.source_type || !payload.source_name || !payload.content_type || !payload.raw_content) {
      return NextResponse.json(
        { error: 'Missing required fields: source_type, source_name, content_type, raw_content' },
        { status: 400 }
      );
    }
    
    // Validate source_type enum
    const validTypes = ['chat', 'repo', 'doc', 'api', 'web', 'manual'];
    if (!validTypes.includes(payload.source_type)) {
      return NextResponse.json(
        { error: `Invalid source_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Normalize content
    const contentText = normalizeText(payload.raw_content);
    const contentHash = generateHash(contentText);
    
    // Check for duplicates
    const { data: existing } = await supabase
      .from('javari_learning_queue')
      .select('id')
      .eq('raw_content', contentText)
      .limit(1);
    
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { 
          error: 'Duplicate content detected',
          existing_id: existing[0].id,
          content_hash: contentHash
        },
        { status: 409 }
      );
    }
    
    // Insert into learning queue (will be processed into knowledge base)
    const { data: queueEntry, error: queueError } = await supabase
      .from('javari_learning_queue')
      .insert({
        source: payload.source_name,
        content_type: payload.content_type,
        raw_content: contentText,
        priority: 5,
        processed: false,
        learning_outcome: {
          source_type: payload.source_type,
          source_url: payload.source_url,
          license_or_tos_url: payload.license_or_tos_url,
          tags: payload.tags || [],
          category: payload.category,
          content_hash: contentHash
        }
      })
      .select()
      .single();
    
    if (queueError) {
      throw new Error(`Queue insert failed: ${queueError.message}`);
    }
    
    // Also insert directly into knowledge base for immediate searchability
    const { data: kbEntry, error: kbError } = await supabase
      .from('javari_knowledge_base')
      .insert({
        category: payload.category || 'general',
        topic: payload.source_name,
        question: `Knowledge from ${payload.source_type}: ${payload.source_name}`,
        answer: contentText,
        short_answer: contentText.substring(0, 200),
        source: payload.source_name,
        source_url: payload.source_url,
        keywords: payload.tags || [],
        confidence_score: 0.80,
        is_active: true
      })
      .select()
      .single();
    
    // Log activity
    await supabase.from('activity_logs').insert({
      action_type: 'knowledge_ingest',
      component: 'brain_v1',
      metadata: {
        source_type: payload.source_type,
        source_name: payload.source_name,
        content_hash: contentHash,
        queue_id: queueEntry.id,
        kb_id: kbEntry?.id
      },
      success: true,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge ingested successfully',
      queue_id: queueEntry.id,
      knowledge_id: kbEntry?.id,
      content_hash: contentHash,
      citation: {
        source_name: payload.source_name,
        source_url: payload.source_url,
        license_or_tos_url: payload.license_or_tos_url,
        ingested_at: new Date().toISOString()
      },
      duration_ms: Date.now() - startTime
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failure
    await supabase.from('activity_logs').insert({
      action_type: 'knowledge_ingest',
      component: 'brain_v1',
      metadata: { error: errorMessage },
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Ingestion failed', details: errorMessage },
      { status: 500 }
    );
  }
}
