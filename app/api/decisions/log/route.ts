import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DecisionPayload {
  related_knowledge_id?: string;
  decision: string;
  adopted: boolean;
  rationale: string;
  links?: string[];
  component?: string;
  confidence?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const payload: DecisionPayload = await request.json();
    
    // Validate required fields
    if (!payload.decision || payload.adopted === undefined || !payload.rationale) {
      return NextResponse.json(
        { error: 'Missing required fields: decision, adopted, rationale' },
        { status: 400 }
      );
    }
    
    // If related_knowledge_id provided, verify it exists
    if (payload.related_knowledge_id) {
      const { data: kbEntry } = await supabase
        .from('javari_knowledge_base')
        .select('id')
        .eq('id', payload.related_knowledge_id)
        .single();
      
      if (!kbEntry) {
        return NextResponse.json(
          { error: 'Related knowledge ID not found', provided_id: payload.related_knowledge_id },
          { status: 404 }
        );
      }
    }
    
    // Log the decision to activity_logs (using existing table for V1)
    const { data: logEntry, error: logError } = await supabase
      .from('activity_logs')
      .insert({
        action_type: 'decision_logged',
        component: payload.component || 'brain_v1',
        metadata: {
          decision: payload.decision,
          adopted: payload.adopted,
          rationale: payload.rationale,
          related_knowledge_id: payload.related_knowledge_id,
          links: payload.links || [],
          confidence: payload.confidence || 0.80
        },
        success: payload.adopted,
        duration_ms: Date.now() - startTime
      })
      .select()
      .single();
    
    if (logError) {
      throw new Error(`Decision log failed: ${logError.message}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Decision logged successfully',
      decision_id: logEntry.id,
      decision: {
        text: payload.decision,
        adopted: payload.adopted,
        rationale: payload.rationale,
        component: payload.component || 'brain_v1',
        logged_at: logEntry.created_at
      },
      duration_ms: Date.now() - startTime
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase.from('activity_logs').insert({
      action_type: 'decision_log_failed',
      component: 'brain_v1',
      metadata: { error: errorMessage },
      success: false,
      error_message: errorMessage,
      duration_ms: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Decision logging failed', details: errorMessage },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve recent decisions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const component = searchParams.get('component');
  
  try {
    let queryBuilder = supabase
      .from('activity_logs')
      .select('*')
      .eq('action_type', 'decision_logged')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (component) {
      queryBuilder = queryBuilder.eq('component', component);
    }
    
    const { data, error } = await queryBuilder;
    
    if (error) {
      throw new Error(`Fetch decisions failed: ${error.message}`);
    }
    
    const decisions = (data || []).map(row => ({
      id: row.id,
      decision: row.metadata?.decision,
      adopted: row.metadata?.adopted,
      rationale: row.metadata?.rationale,
      component: row.component,
      created_at: row.created_at,
      links: row.metadata?.links || []
    }));
    
    return NextResponse.json({
      success: true,
      total: decisions.length,
      decisions
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch decisions', details: errorMessage },
      { status: 500 }
    );
  }
}
