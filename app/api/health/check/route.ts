import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, logSelfHealing } from '@/lib/supabase';

interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  details?: string;
  last_success?: string;
  error_count?: number;
}

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleHealthCheck(request);
}

export async function POST(request: NextRequest) {
  return handleHealthCheck(request);
}

async function handleHealthCheck(request: NextRequest) {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  try {
    // 1. Check Supabase connectivity
    const dbStart = Date.now();
    try {
      const { data, error } = await supabase
        .from('javari_data_sources')
        .select('count')
        .limit(1);
      
      const dbLatency = Date.now() - dbStart;
      
      if (error) {
        checks.push({
          component: 'supabase',
          status: 'unhealthy',
          latency_ms: dbLatency,
          details: error.message,
        });
        overallStatus = 'unhealthy';
      } else {
        checks.push({
          component: 'supabase',
          status: dbLatency > 2000 ? 'degraded' : 'healthy',
          latency_ms: dbLatency,
        });
        if (dbLatency > 2000) overallStatus = 'degraded';
      }
    } catch (error) {
      checks.push({
        component: 'supabase',
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      overallStatus = 'unhealthy';
    }

    // 2. Check data sources health
    const { data: sources } = await supabase
      .from('javari_data_sources')
      .select('*')
      .eq('is_active', true);

    if (sources) {
      for (const source of sources) {
        const hoursSinceLastFetch = source.last_fetch
          ? (Date.now() - new Date(source.last_fetch).getTime()) / (1000 * 60 * 60)
          : 999;
        
        const fetchFrequencyHours = parseFrequency(source.fetch_frequency || '01:00:00');
        const missedFetches = Math.floor(hoursSinceLastFetch / fetchFrequencyHours) - 1;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (missedFetches >= 3 || source.error_count > 5) {
          status = 'unhealthy';
          overallStatus = 'unhealthy';
        } else if (missedFetches >= 1 || source.error_count > 2) {
          status = 'degraded';
          if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
        }

        checks.push({
          component: `source:${source.name}`,
          status,
          last_success: source.last_fetch,
          error_count: source.error_count,
          details: source.last_error || undefined,
        });
      }
    }

    // 3. Check learning queue backlog
    const { count: queueCount } = await supabase
      .from('javari_learning_queue')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    const queueBacklog = queueCount || 0;
    let queueStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (queueBacklog > 10000) {
      queueStatus = 'unhealthy';
      overallStatus = 'unhealthy';
    } else if (queueBacklog > 5000) {
      queueStatus = 'degraded';
      if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
    }

    checks.push({
      component: 'learning_queue',
      status: queueStatus,
      details: `${queueBacklog} items pending`,
    });

    // 4. Check recent self-healing events
    const { data: recentIssues } = await supabase
      .from('javari_self_healing_log')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const criticalIssues = recentIssues?.filter(i => i.severity === 'critical' && !i.resolved_at) || [];
    const highIssues = recentIssues?.filter(i => i.severity === 'high' && !i.resolved_at) || [];

    if (criticalIssues.length > 0) {
      checks.push({
        component: 'self_healing',
        status: 'unhealthy',
        details: `${criticalIssues.length} critical issues unresolved`,
      });
      overallStatus = 'unhealthy';
    } else if (highIssues.length > 0) {
      checks.push({
        component: 'self_healing',
        status: 'degraded',
        details: `${highIssues.length} high-severity issues`,
      });
      if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
    } else {
      checks.push({
        component: 'self_healing',
        status: 'healthy',
        details: `${recentIssues?.length || 0} issues in last 24h`,
      });
    }

    const duration = Date.now() - startTime;

    // Log the health check
    await logActivity(
      'health_check',
      'javari-autonomous-system',
      {
        overall_status: overallStatus,
        checks: checks.length,
        unhealthy: checks.filter(c => c.status === 'unhealthy').length,
        degraded: checks.filter(c => c.status === 'degraded').length,
      },
      overallStatus !== 'unhealthy',
      overallStatus === 'unhealthy' ? 'System unhealthy' : undefined,
      duration
    );

    // If unhealthy, create self-healing log entry
    if (overallStatus === 'unhealthy') {
      await logSelfHealing({
        component: 'health-check',
        issue_type: 'system_unhealthy',
        issue_description: `Health check found ${checks.filter(c => c.status === 'unhealthy').length} unhealthy components`,
        severity: 'high',
        auto_healed: false,
        requires_human: true,
        notified: false,
      });
    }

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      checks,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    await logSelfHealing({
      component: 'health-check',
      issue_type: 'health_check_failed',
      issue_description: errorMsg,
      severity: 'critical',
      auto_healed: false,
      requires_human: true,
      notified: false,
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMsg,
      checks,
    }, { status: 500 });
  }
}

function parseFrequency(freq: string): number {
  // Parse PostgreSQL interval like "01:00:00" or "06:00:00"
  const parts = freq.split(':');
  if (parts.length >= 2) {
    return parseInt(parts[0], 10) || 1;
  }
  return 1;
}
