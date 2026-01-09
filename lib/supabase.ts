import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

// Type definitions for Javari tables
export interface KnowledgeBase {
  id?: string;
  category: string;
  topic: string;
  question?: string;
  answer?: string;
  short_answer?: string;
  source?: string;
  source_url?: string;
  last_verified?: string;
  confidence_score?: number;
  times_used?: number;
  helpful_votes?: number;
  unhelpful_votes?: number;
  keywords?: string[];
  is_active?: boolean;
  requires_update?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DataSource {
  id?: string;
  name: string;
  source_type: 'api' | 'scrape' | 'manual' | 'conversation';
  url?: string;
  api_key_env?: string;
  fetch_frequency?: string;
  last_fetch?: string;
  next_fetch?: string;
  is_active?: boolean;
  config?: Record<string, unknown>;
  error_count?: number;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SelfHealingLog {
  id?: string;
  component: string;
  issue_type: string;
  issue_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_healed: boolean;
  healing_action?: string;
  healing_result?: string;
  requires_human?: boolean;
  notified?: boolean;
  created_at?: string;
  resolved_at?: string;
}

export interface LearningQueue {
  id?: string;
  source: string;
  content_type: string;
  raw_content: string;
  processed?: boolean;
  processed_at?: string;
  learning_outcome?: Record<string, unknown>;
  priority?: number;
  created_at?: string;
}

export interface ActivityLog {
  id?: string;
  action_type: string;
  component: string;
  details?: Record<string, unknown>;
  success: boolean;
  error_message?: string;
  execution_time_ms?: number;
  created_at?: string;
}

// Helper functions
export async function logActivity(
  actionType: string,
  component: string,
  details: Record<string, unknown>,
  success: boolean,
  errorMessage?: string,
  executionTimeMs?: number
): Promise<void> {
  try {
    await supabase.from('javari_activity_log').insert({
      action_type: actionType,
      component: component,
      details: details,
      success: success,
      error_message: errorMessage,
      execution_time_ms: executionTimeMs,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function logSelfHealing(log: Omit<SelfHealingLog, 'id' | 'created_at'>): Promise<void> {
  try {
    await supabase.from('javari_self_healing_log').insert(log);
  } catch (error) {
    console.error('Failed to log self-healing event:', error);
  }
}

export async function addToLearningQueue(
  source: string,
  contentType: string,
  rawContent: string,
  priority: number = 5
): Promise<void> {
  try {
    await supabase.from('javari_learning_queue').insert({
      source,
      content_type: contentType,
      raw_content: rawContent,
      processed: false,
      priority,
    });
  } catch (error) {
    console.error('Failed to add to learning queue:', error);
  }
}

export async function updateDataSource(
  name: string,
  updates: Partial<DataSource>
): Promise<void> {
  try {
    await supabase
      .from('javari_data_sources')
      .update(updates)
      .eq('name', name);
  } catch (error) {
    console.error('Failed to update data source:', error);
  }
}

export async function upsertKnowledge(knowledge: KnowledgeBase): Promise<void> {
  try {
    await supabase
      .from('javari_knowledge_base')
      .upsert(knowledge, { onConflict: 'topic' });
  } catch (error) {
    console.error('Failed to upsert knowledge:', error);
  }
}
