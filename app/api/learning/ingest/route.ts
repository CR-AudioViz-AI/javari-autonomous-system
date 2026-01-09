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
    
    // Check for duplicates by checking existing answer content
    const { data: existing } = await supabase
      .from('javari_knowledge_base')
      .select('id, topic')
      .eq('answer', contentText)
      .limit(1);
    
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { 
          error: 'Duplicate content detected',
          existing_id: existing[0].id,
          existing_topic: existing[0].topic,
          content_hash: contentHash
        },
        { status: 409 }
      );
    }
    
    // Generate unique topic to avoid constraint violation
    const uniqueTopic = `${payload.source_name}_${Date.now()}`;
    
    // Insert directly into knowledge base for V1
    const { data: kbEntry, error: kbError } = await supabase
      .from('javari_knowledge_base')
      .insert({
        category: payload.category || 'ingested',
        topic: uniqueTopic,
        question: `Knowledge from ${payload.source_type}: ${payload.source_name}`,
        answer: contentText,
        short_answer: contentText.substring(0, 200),
        source: payload.source_name,
        source_url: payload.source_url || null,
        keywords: payload.tags || [],
        confidence_score: 0.80,
        is_active: true
      })
      .select()
      .single();
    
    if (kbError) {
      throw new Error(`Knowledge base insert failed: ${kbError.message}`);
    }
    
    // Log activity
    await supabase.from('activity_logs').insert({
      action_type: 'knowledge_ingest',
      component: 'brain_v1',
      metadata: {
        source_type: payload.source_type,
        source_name: payload.source_name,
        source_url: payload.source_url,
        license_or_tos_url: payload.license_or_tos_url,
        content_hash: contentHash,
        kb_id: kbEntry.id,
        tags: payload.tags
      },
      success: true,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge ingested successfully',
      knowledge_id: kbEntry.id,
      content_hash: contentHash,
      citation: {
        source_name: payload.source_name,
        source_url: payload.source_url,
        license_or_tos_url: payload.license_or_tos_url,
        ingested_at: kbEntry.created_at
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
