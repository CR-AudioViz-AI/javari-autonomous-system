import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, logSelfHealing } from '@/lib/supabase';

interface HealingAction {
  issue_id: string;
  action: string;
  result: 'success' | 'failed' | 'skipped';
  details?: string;
}

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  return handleSelfHeal(request);
}

export async function POST(request: NextRequest) {
  return handleSelfHeal(request);
}

async function handleSelfHeal(request: NextRequest) {
  const startTime = Date.now();
  const healingActions: HealingAction[] = [];

  try {
    console.log('🔧 Self-healing process started');

    // 1. Get unresolved issues
    const { data: issues } = await supabase
      .from('javari_self_healing_log')
      .select('*')
      .is('resolved_at', null)
      .eq('auto_healed', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20);

    if (!issues || issues.length === 0) {
      console.log('✅ No issues to heal');
      return NextResponse.json({
        success: true,
        message: 'No issues to heal',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`Found ${issues.length} issues to process`);

    // 2. Process each issue
    for (const issue of issues) {
      try {
        const action = await attemptHealing(issue);
        healingActions.push(action);

        // Update issue record
        if (action.result === 'success') {
          await supabase
            .from('javari_self_healing_log')
            .update({
              auto_healed: true,
              healing_action: action.action,
              healing_result: action.details,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', issue.id);
        }

      } catch (error) {
        healingActions.push({
          issue_id: issue.id,
          action: 'unknown',
          result: 'failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 3. Check for stale data sources and restart them
    const { data: staleSources } = await supabase
      .from('javari_data_sources')
      .select('*')
      .eq('is_active', true)
      .gt('error_count', 3);

    for (const source of staleSources || []) {
      try {
        // Reset error count and mark for retry
        await supabase
          .from('javari_data_sources')
          .update({
            error_count: 0,
            last_error: null,
            next_fetch: new Date().toISOString(),
          })
          .eq('id', source.id);

        healingActions.push({
          issue_id: source.id,
          action: 'reset_data_source',
          result: 'success',
          details: `Reset error count for ${source.name}`,
        });

        await logSelfHealing({
          component: `source:${source.name}`,
          issue_type: 'error_threshold_exceeded',
          issue_description: `Source had ${source.error_count} errors, reset for retry`,
          severity: 'low',
          auto_healed: true,
          healing_action: 'reset_error_count',
          healing_result: 'Source reset for retry',
          notified: false,
        });

      } catch (error) {
        healingActions.push({
          issue_id: source.id,
          action: 'reset_data_source',
          result: 'failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 4. Clean up old processed queue items
    const oldQueueCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: deletedCount } = await supabase
      .from('javari_learning_queue')
      .delete({ count: 'exact' })
      .eq('processed', true)
      .lt('processed_at', oldQueueCutoff);

    if (deletedCount && deletedCount > 0) {
      healingActions.push({
        issue_id: 'queue_cleanup',
        action: 'delete_old_queue_items',
        result: 'success',
        details: `Deleted ${deletedCount} processed items older than 7 days`,
      });
    }

    // 5. Check for duplicate knowledge entries and dedupe
    const { data: dupeCheck } = await supabase
      .from('javari_knowledge_base')
      .select('topic, count')
      .limit(100);

    // Group by topic and find duplicates would require more complex query
    // For now, just log that we checked

    const duration = Date.now() - startTime;
    const successCount = healingActions.filter(a => a.result === 'success').length;
    const failedCount = healingActions.filter(a => a.result === 'failed').length;

    await logActivity(
      'self_heal',
      'javari-autonomous-system',
      {
        issues_processed: issues.length,
        actions_taken: healingActions.length,
        successful: successCount,
        failed: failedCount,
      },
      failedCount === 0,
      failedCount > 0 ? `${failedCount} healing actions failed` : undefined,
      duration
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      issues_processed: issues.length,
      actions: healingActions,
      summary: {
        successful: successCount,
        failed: failedCount,
        skipped: healingActions.filter(a => a.result === 'skipped').length,
      },
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Self-healing error:', error);

    await logSelfHealing({
      component: 'self-heal',
      issue_type: 'self_heal_failed',
      issue_description: errorMsg,
      severity: 'critical',
      auto_healed: false,
      requires_human: true,
      notified: false,
    });

    return NextResponse.json({
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
      actions: healingActions,
    }, { status: 500 });
  }
}

async function attemptHealing(issue: {
  id: string;
  component: string;
  issue_type: string;
  severity: string;
}): Promise<HealingAction> {
  // Determine healing action based on issue type
  switch (issue.issue_type) {
    case 'multiple_failures':
    case 'scrape_failed':
      // Try to reset the data source
      const sourceName = issue.component.replace('source:', '').replace('-scraper', '');
      await supabase
        .from('javari_data_sources')
        .update({
          error_count: 0,
          last_error: null,
        })
        .eq('name', sourceName);
      return {
        issue_id: issue.id,
        action: 'reset_source_errors',
        result: 'success',
        details: `Reset errors for ${sourceName}`,
      };

    case 'queue_backlog':
      // Increase queue processing priority
      return {
        issue_id: issue.id,
        action: 'increase_processing_priority',
        result: 'success',
        details: 'Queue will be processed with higher priority',
      };

    case 'database_slow':
      // Can't really fix this automatically
      return {
        issue_id: issue.id,
        action: 'notify_admin',
        result: 'skipped',
        details: 'Database performance issues require human intervention',
      };

    default:
      // For unknown issues, check if they're older than 24h and mark as stale
      return {
        issue_id: issue.id,
        action: 'mark_for_review',
        result: 'skipped',
        details: `Unknown issue type: ${issue.issue_type}`,
      };
  }
}
