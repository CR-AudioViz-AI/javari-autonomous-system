import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, addToLearningQueue, logSelfHealing } from '@/lib/supabase';

const DEVDOCS_API = 'https://devdocs.io';

const DOCS_TO_SCRAPE = [
  'react',
  'typescript',
  'javascript',
  'node',
  'nextjs~14',
  'tailwindcss',
  'postgresql',
  'git',
  'html',
  'css',
  'dom',
  'http',
  'python~3.12',
  'bash',
];

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleScrape(request);
}

export async function POST(request: NextRequest) {
  return handleScrape(request);
}

async function handleScrape(request: NextRequest) {
  const startTime = Date.now();
  
  // Verify cron secret for automated calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow manual triggers without auth for testing
    const isManual = request.nextUrl.searchParams.get('manual') === 'true';
    if (!isManual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let totalScraped = 0;
  let totalErrors = 0;
  const errors: string[] = [];

  try {
    console.log('🚀 DevDocs scraper started');

    // Ensure data source exists
    const { error: sourceError } = await supabase
      .from('javari_data_sources')
      .upsert({
        name: 'devdocs',
        source_type: 'scrape',
        url: DEVDOCS_API,
        fetch_frequency: '06:00:00',
        is_active: true,
        last_fetch: new Date().toISOString(),
        config: { docs: DOCS_TO_SCRAPE },
      }, { onConflict: 'name' });

    if (sourceError) {
      console.error('Source error:', sourceError);
    }

    // Scrape each documentation set
    for (const docSlug of DOCS_TO_SCRAPE) {
      try {
        console.log(`📚 Scraping: ${docSlug}`);
        
        const indexResponse = await fetch(`${DEVDOCS_API}/docs/${docSlug}/index.json`, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!indexResponse.ok) {
          console.error(`❌ Failed to fetch ${docSlug}: ${indexResponse.status}`);
          totalErrors++;
          errors.push(`${docSlug}: HTTP ${indexResponse.status}`);
          continue;
        }

        const index = await indexResponse.json();
        const entries = index.entries || [];
        
        console.log(`Found ${entries.length} entries for ${docSlug}`);

        // Add to learning queue for AI processing
        for (const entry of entries.slice(0, 100)) { // Limit per doc
          await addToLearningQueue(
            'devdocs',
            'documentation',
            JSON.stringify({
              doc: docSlug,
              title: entry.name,
              type: entry.type,
              path: entry.path,
              url: `${DEVDOCS_API}/${docSlug}/${entry.path}`,
            }),
            8 // High priority for documentation
          );
          totalScraped++;
        }

        console.log(`✅ Completed ${docSlug}: ${Math.min(entries.length, 100)} entries queued`);
        
        // Small delay between docs
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error scraping ${docSlug}:`, errorMsg);
        totalErrors++;
        errors.push(`${docSlug}: ${errorMsg}`);
        
        // Log self-healing if needed
        if (totalErrors > 3) {
          await logSelfHealing({
            component: 'devdocs-scraper',
            issue_type: 'multiple_failures',
            issue_description: `Multiple scraping failures: ${errors.join(', ')}`,
            severity: 'medium',
            auto_healed: false,
            requires_human: totalErrors > 5,
            notified: false,
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    // Update data source stats
    await supabase
      .from('javari_data_sources')
      .update({
        last_fetch: new Date().toISOString(),
        error_count: totalErrors,
        last_error: errors.length > 0 ? errors[errors.length - 1] : null,
        config: {
          docs: DOCS_TO_SCRAPE,
          last_scrape_duration_ms: duration,
          last_scrape_count: totalScraped,
          last_scrape_errors: totalErrors,
        },
      })
      .eq('name', 'devdocs');

    // Log activity
    await logActivity(
      'scrape_devdocs',
      'javari-autonomous-system',
      {
        scraped: totalScraped,
        errors: totalErrors,
        errorDetails: errors,
      },
      totalErrors === 0,
      errors.length > 0 ? errors.join(', ') : undefined,
      duration
    );

    const response = {
      success: true,
      source: 'DevDocs',
      scraped: totalScraped,
      errors: totalErrors,
      errorDetails: errors.length > 0 ? errors : undefined,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ DevDocs scraping complete:', response);
    return NextResponse.json(response);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fatal error:', error);
    
    await logActivity(
      'scrape_devdocs',
      'javari-autonomous-system',
      { error: errorMsg },
      false,
      errorMsg,
      Date.now() - startTime
    );

    await logSelfHealing({
      component: 'devdocs-scraper',
      issue_type: 'fatal_error',
      issue_description: errorMsg,
      severity: 'high',
      auto_healed: false,
      requires_human: true,
      notified: false,
    });

    return NextResponse.json({
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
