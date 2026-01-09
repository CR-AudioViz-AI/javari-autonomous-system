import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SearchResult {
  id: string;
  snippet: string;
  source_name: string;
  source_url: string | null;
  license_or_tos_url: string | null;
  created_at: string;
  confidence: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const k = parseInt(searchParams.get('k') || '10', 10);
  
  if (!query) {
    return NextResponse.json(
      { error: 'Missing required parameter: q (search query)' },
      { status: 400 }
    );
  }
  
  if (k < 1 || k > 100) {
    return NextResponse.json(
      { error: 'Parameter k must be between 1 and 100' },
      { status: 400 }
    );
  }
  
  try {
    // Search using ILIKE for V1 (can upgrade to full-text search later)
    const searchTerms = query.split(' ').filter(t => t.length > 2);
    
    let queryBuilder = supabase
      .from('javari_knowledge_base')
      .select('id, topic, answer, source, source_url, created_at, confidence_score, keywords')
      .eq('is_active', true);
    
    // Build OR conditions for each search term
    if (searchTerms.length > 0) {
      const orConditions = searchTerms.map(term => 
        `answer.ilike.%${term}%,topic.ilike.%${term}%,source.ilike.%${term}%`
      ).join(',');
      queryBuilder = queryBuilder.or(orConditions);
    }
    
    const { data, error } = await queryBuilder
      .order('confidence_score', { ascending: false })
      .limit(k);
    
    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
    
    // Transform results to include citation metadata
    const results: SearchResult[] = (data || []).map((row, index) => ({
      id: row.id,
      snippet: row.answer.substring(0, 300) + (row.answer.length > 300 ? '...' : ''),
      source_name: row.source || row.topic,
      source_url: row.source_url,
      license_or_tos_url: null, // Not in current schema, would be in extended schema
      created_at: row.created_at,
      confidence: row.confidence_score || (1 - (index * 0.05)) // Decay by position if no score
    }));
    
    // Log search activity
    await supabase.from('activity_logs').insert({
      action_type: 'knowledge_search',
      component: 'brain_v1',
      metadata: {
        query,
        k,
        results_count: results.length,
        search_terms: searchTerms
      },
      success: true,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: true,
      query,
      total_results: results.length,
      results,
      duration_ms: Date.now() - startTime
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase.from('activity_logs').insert({
      action_type: 'knowledge_search',
      component: 'brain_v1',
      metadata: { query, error: errorMessage },
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Search failed', details: errorMessage },
      { status: 500 }
    );
  }
}
