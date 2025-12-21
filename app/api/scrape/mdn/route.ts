import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, addToLearningQueue, logSelfHealing } from '@/lib/supabase';

const MDN_API = 'https://developer.mozilla.org';

const SECTIONS_TO_SCRAPE = [
  '/en-US/docs/Web/JavaScript/Reference',
  '/en-US/docs/Web/CSS/Reference',
  '/en-US/docs/Web/HTML/Reference',
  '/en-US/docs/Web/API',
  '/en-US/docs/Web/HTTP',
  '/en-US/docs/Web/Security',
  '/en-US/docs/Web/Accessibility',
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
  
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const isManual = request.nextUrl.searchParams.get('manual') === 'true';
    if (!isManual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let totalScraped = 0;
  let totalErrors = 0;
  const errors: string[] = [];

  try {
    console.log('🚀 MDN scraper started');

    // Ensure data source exists
    await supabase
      .from('javari_data_sources')
      .upsert({
        name: 'mdn',
        source_type: 'scrape',
        url: MDN_API,
        fetch_frequency: '06:00:00',
        is_active: true,
        last_fetch: new Date().toISOString(),
        config: { sections: SECTIONS_TO_SCRAPE },
      }, { onConflict: 'name' });

    // Scrape each section
    for (const section of SECTIONS_TO_SCRAPE) {
      try {
        console.log(`📚 Scraping MDN section: ${section}`);
        
        // MDN provides a JSON index for each section
        const indexUrl = `${MDN_API}${section}/index.json`;
        const indexResponse = await fetch(indexUrl, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (!indexResponse.ok) {
          // Try alternative API endpoint
          const altUrl = `${MDN_API}/api/v1/whoami`; // Test endpoint
          console.log(`Section ${section} not available via index.json`);
          
          // Add section metadata to learning queue
          await addToLearningQueue(
            'mdn',
            'documentation_section',
            JSON.stringify({
              section,
              url: `${MDN_API}${section}`,
              needs_deep_scrape: true,
            }),
            7
          );
          totalScraped++;
          continue;
        }

        const data = await indexResponse.json();
        const doc = data.doc || {};
        
        // Extract child pages if available
        const children = doc.children || [];
        
        for (const child of children.slice(0, 50)) {
          await addToLearningQueue(
            'mdn',
            'documentation',
            JSON.stringify({
              section,
              title: child.title || child.slug,
              slug: child.slug,
              url: `${MDN_API}${section}/${child.slug}`,
              summary: child.summary || '',
            }),
            8
          );
          totalScraped++;
        }

        console.log(`✅ Completed MDN section ${section}: ${Math.min(children.length, 50)} entries`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error scraping MDN ${section}:`, errorMsg);
        totalErrors++;
        errors.push(`${section}: ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;

    await supabase
      .from('javari_data_sources')
      .update({
        last_fetch: new Date().toISOString(),
        error_count: totalErrors,
        last_error: errors.length > 0 ? errors[errors.length - 1] : null,
        config: {
          sections: SECTIONS_TO_SCRAPE,
          last_scrape_duration_ms: duration,
          last_scrape_count: totalScraped,
        },
      })
      .eq('name', 'mdn');

    await logActivity(
      'scrape_mdn',
      'javari-autonomous-system',
      { scraped: totalScraped, errors: totalErrors },
      totalErrors === 0,
      errors.length > 0 ? errors.join(', ') : undefined,
      duration
    );

    return NextResponse.json({
      success: true,
      source: 'MDN',
      scraped: totalScraped,
      errors: totalErrors,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fatal error:', error);
    
    await logSelfHealing({
      component: 'mdn-scraper',
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
