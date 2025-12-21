import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return generateDailyReport(request);
}

export async function POST(request: NextRequest) {
  return generateDailyReport(request);
}

async function generateDailyReport(request: NextRequest) {
  const startTime = Date.now();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayISO = yesterday.toISOString();

  try {
    console.log('📊 Generating daily report');

    // 1. Learning metrics
    const { count: newKnowledge } = await supabase
      .from('javari_knowledge_base')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayISO);

    const { count: queueProcessed } = await supabase
      .from('javari_learning_queue')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('processed_at', yesterdayISO);

    const { count: queuePending } = await supabase
      .from('javari_learning_queue')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    // 2. Data source health
    const { data: sources } = await supabase
      .from('javari_data_sources')
      .select('*');

    const sourceHealth = sources?.map(s => ({
      name: s.name,
      active: s.is_active,
      lastFetch: s.last_fetch,
      errorCount: s.error_count,
      lastError: s.last_error,
    })) || [];

    const healthySources = sourceHealth.filter(s => s.active && s.errorCount === 0).length;
    const degradedSources = sourceHealth.filter(s => s.active && s.errorCount > 0 && s.errorCount <= 3).length;
    const unhealthySources = sourceHealth.filter(s => !s.active || s.errorCount > 3).length;

    // 3. Self-healing metrics
    const { data: healingEvents } = await supabase
      .from('javari_self_healing_log')
      .select('*')
      .gte('created_at', yesterdayISO);

    const issuesDetected = healingEvents?.length || 0;
    const issuesAutoHealed = healingEvents?.filter(e => e.auto_healed).length || 0;
    const issuesRequiringHuman = healingEvents?.filter(e => e.requires_human && !e.resolved_at).length || 0;

    // 4. Activity summary
    const { data: activities } = await supabase
      .from('javari_activity_log')
      .select('action_type, success')
      .gte('created_at', yesterdayISO);

    const activitySummary: Record<string, { total: number; success: number; failed: number }> = {};
    activities?.forEach(a => {
      if (!activitySummary[a.action_type]) {
        activitySummary[a.action_type] = { total: 0, success: 0, failed: 0 };
      }
      activitySummary[a.action_type].total++;
      if (a.success) activitySummary[a.action_type].success++;
      else activitySummary[a.action_type].failed++;
    });

    // 5. Knowledge base stats
    const { count: totalKnowledge } = await supabase
      .from('javari_knowledge_base')
      .select('*', { count: 'exact', head: true });

    const { data: categoryStats } = await supabase
      .from('javari_knowledge_base')
      .select('category');

    const categoryCounts: Record<string, number> = {};
    categoryStats?.forEach(k => {
      categoryCounts[k.category] = (categoryCounts[k.category] || 0) + 1;
    });

    // Generate report
    const report = {
      generated_at: new Date().toISOString(),
      period: {
        start: yesterdayISO,
        end: new Date().toISOString(),
      },
      learning: {
        new_knowledge_items: newKnowledge || 0,
        queue_items_processed: queueProcessed || 0,
        queue_items_pending: queuePending || 0,
        total_knowledge_items: totalKnowledge || 0,
        knowledge_by_category: categoryCounts,
      },
      data_sources: {
        total: sourceHealth.length,
        healthy: healthySources,
        degraded: degradedSources,
        unhealthy: unhealthySources,
        details: sourceHealth,
      },
      self_healing: {
        issues_detected: issuesDetected,
        auto_healed: issuesAutoHealed,
        requiring_human: issuesRequiringHuman,
        heal_rate: issuesDetected > 0 ? `${((issuesAutoHealed / issuesDetected) * 100).toFixed(1)}%` : '100%',
      },
      activity: activitySummary,
      system_status: determineOverallStatus(healthySources, degradedSources, unhealthySources, issuesRequiringHuman),
    };

    // Store report
    await supabase.from('javari_activity_log').insert({
      action_type: 'daily_report',
      component: 'javari-autonomous-system',
      details: report,
      success: true,
      execution_time_ms: Date.now() - startTime,
    });

    // Send to external notification if configured
    if (process.env.DISCORD_WEBHOOK_URL) {
      await sendDiscordNotification(report);
    }

    await logActivity(
      'generate_daily_report',
      'javari-autonomous-system',
      { report_id: new Date().toISOString().split('T')[0] },
      true,
      undefined,
      Date.now() - startTime
    );

    return NextResponse.json({
      success: true,
      report,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Report generation error:', error);

    return NextResponse.json({
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

function determineOverallStatus(
  healthy: number,
  degraded: number,
  unhealthy: number,
  humanRequired: number
): 'excellent' | 'good' | 'degraded' | 'critical' {
  if (unhealthy > 0 || humanRequired > 2) return 'critical';
  if (degraded > 2 || humanRequired > 0) return 'degraded';
  if (degraded > 0) return 'good';
  return 'excellent';
}

async function sendDiscordNotification(report: Record<string, unknown>): Promise<void> {
  try {
    const status = report.system_status as string;
    const statusEmoji = {
      excellent: '🟢',
      good: '🟡',
      degraded: '🟠',
      critical: '🔴',
    }[status] || '⚪';

    const learning = report.learning as Record<string, unknown>;
    const selfHealing = report.self_healing as Record<string, unknown>;
    const dataSources = report.data_sources as Record<string, unknown>;

    const message = {
      embeds: [{
        title: `${statusEmoji} Javari AI Daily Report`,
        color: status === 'excellent' ? 0x00ff00 : status === 'good' ? 0xffff00 : status === 'degraded' ? 0xff8800 : 0xff0000,
        fields: [
          {
            name: '📚 Learning',
            value: `New: ${learning.new_knowledge_items}\nProcessed: ${learning.queue_items_processed}\nPending: ${learning.queue_items_pending}`,
            inline: true,
          },
          {
            name: '🔧 Self-Healing',
            value: `Detected: ${selfHealing.issues_detected}\nAuto-healed: ${selfHealing.auto_healed}\nRate: ${selfHealing.heal_rate}`,
            inline: true,
          },
          {
            name: '📡 Data Sources',
            value: `Healthy: ${dataSources.healthy}/${dataSources.total}\nDegraded: ${dataSources.degraded}\nUnhealthy: ${dataSources.unhealthy}`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      }],
    };

    await fetch(process.env.DISCORD_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}
