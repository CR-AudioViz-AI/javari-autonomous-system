/**
 * CR AudioViz AI - Supabase Client
 * =================================
 * 
 * Universal database client for CR AudioViz AI apps.
 * For authentication, credits, and central services, use:
 * 
 *   import { CentralServices, CentralAuth, CentralCredits } from './central-services';
 * 
 * This client is for app-specific database operations only.
 * Auth, payments, and credits should ALWAYS go through central services.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Re-export admin utilities from central services
export { isAdmin, shouldChargeCredits, ADMIN_EMAILS, CentralServices } from './central-services';

// Centralized Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kteobfyferrukqeolofj.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZW9iZnlmZXJydWtxZW9sb2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTcyNjYsImV4cCI6MjA3NzU1NzI2Nn0.uy-jlF_z6qVb8qogsNyGDLHqT4HhmdRhLrW7zPv3qhY';

// Standard client for general use
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Browser client for auth (SSR-safe singleton pattern)
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: return new client each time
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  
  // Client-side: return singleton
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return browserClient;
}

// Server client for API routes
export function createSupabaseServerClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key');
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return createClient(SUPABASE_URL, serviceKey);
}

// ============================================================================
// ACTIVITY LOGGING - Added for javari-autonomous-system
// ============================================================================

/**
 * Log an activity to the activity_logs table
 * @param actionType - The type of action (e.g., 'health_check', 'self_heal')
 * @param component - The component that performed the action
 * @param metadata - Additional metadata about the action
 * @param success - Whether the action was successful
 * @param errorMessage - Error message if the action failed
 * @param durationMs - Duration of the action in milliseconds
 */
export async function logActivity(
  actionType: string,
  component: string,
  metadata: Record<string, unknown> = {},
  success: boolean = true,
  errorMessage?: string,
  durationMs?: number
): Promise<void> {
  try {
    const serverClient = createSupabaseServerClient();
    
    const { error } = await serverClient
      .from('activity_logs')
      .insert({
        action_type: actionType,
        component,
        metadata,
        success,
        error_message: errorMessage || null,
        duration_ms: durationMs || null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[logActivity] Failed to log activity:', error.message);
    }
  } catch (err) {
    // Don't throw - logging should never break the main flow
    console.error('[logActivity] Exception:', err instanceof Error ? err.message : 'Unknown error');
  }
}

// ============================================================================
// SELF-HEALING LOGGING - Added for javari-autonomous-system
// ============================================================================

interface SelfHealingLogEntry {
  component: string;
  issue_type: string;
  issue_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  auto_healed: boolean;
  healing_action?: string;
  healing_result?: string;
  requires_human?: boolean;
  notified?: boolean;
}

/**
 * Log a self-healing event to the javari_self_healing_log table
 * @param entry - The self-healing log entry
 */
export async function logSelfHealing(entry: SelfHealingLogEntry): Promise<void> {
  try {
    const serverClient = createSupabaseServerClient();
    
    const { error } = await serverClient
      .from('javari_self_healing_log')
      .insert({
        component: entry.component,
        issue_type: entry.issue_type,
        issue_description: entry.issue_description,
        severity: entry.severity,
        auto_healed: entry.auto_healed,
        healing_action: entry.healing_action || null,
        healing_result: entry.healing_result || null,
        requires_human: entry.requires_human || false,
        notified: entry.notified || false,
        created_at: new Date().toISOString(),
        resolved_at: entry.auto_healed ? new Date().toISOString() : null
      });

    if (error) {
      console.error('[logSelfHealing] Failed to log self-healing event:', error.message);
    }
  } catch (err) {
    // Don't throw - logging should never break the main flow
    console.error('[logSelfHealing] Exception:', err instanceof Error ? err.message : 'Unknown error');
  }
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export default supabase;
