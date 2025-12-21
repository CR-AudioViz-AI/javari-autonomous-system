import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, addToLearningQueue, logSelfHealing } from '@/lib/supabase';

const NEWS_SOURCES = [
  {
    name: 'hackernews',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    itemUrl: 'https://hacker-news.firebaseio.com/v0/item/',
    limit: 30,
  },
  {
    name: 'reddit_technology',
    url: 'https://www.reddit.com/r/technology/hot.json?limit=25',
    type: 'reddit',
  },
  {
    name: 'reddit_programming',
    url: 'https://www.reddit.com/r/programming/hot.json?limit=25',
    type: 'reddit',
  },
  {
    name: 'reddit_webdev',
    url: 'https://www.reddit.com/r/webdev/hot.json?limit=25',
    type: 'reddit',
  },
];

export const runtime = 'nodejs';
export const maxDuration = 120;

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
    console.log('🚀 News scraper started');

    // Scrape HackerNews
    try {
      const hnSource = NEWS_SOURCES[0];
      console.log(`📰 Fetching ${hnSource.name}`);
      
      const hnResponse = await fetch(hnSource.url);
      if (hnResponse.ok) {
        const storyIds = await hnResponse.json();
        const topStories = storyIds.slice(0, hnSource.limit);
        
        for (const storyId of topStories) {
          try {
            const storyResponse = await fetch(`${hnSource.itemUrl}${storyId}.json`);
            if (storyResponse.ok) {
              const story = await storyResponse.json();
              if (story && story.title) {
                await addToLearningQueue(
                  'hackernews',
                  'news',
                  JSON.stringify({
                    id: story.id,
                    title: story.title,
                    url: story.url,
                    score: story.score,
                    by: story.by,
                    time: story.time,
                    type: story.type,
                    descendants: story.descendants,
                  }),
                  5
                );
                totalScraped++;
              }
            }
          } catch {
            // Skip individual story errors
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log(`✅ HackerNews: ${totalScraped} stories`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('HackerNews error:', errorMsg);
      totalErrors++;
      errors.push(`hackernews: ${errorMsg}`);
    }

    // Scrape Reddit sources
    for (const source of NEWS_SOURCES.filter(s => s.type === 'reddit')) {
      try {
        console.log(`📰 Fetching ${source.name}`);
        
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'JavariAI/1.0 (Learning Bot)',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const posts = data.data?.children || [];
          
          for (const post of posts) {
            const postData = post.data;
            if (postData && postData.title) {
              await addToLearningQueue(
                source.name,
                'news',
                JSON.stringify({
                  id: postData.id,
                  title: postData.title,
                  url: postData.url,
                  selftext: postData.selftext?.substring(0, 500),
                  score: postData.score,
                  author: postData.author,
                  created_utc: postData.created_utc,
                  num_comments: postData.num_comments,
                  subreddit: postData.subreddit,
                }),
                4
              );
              totalScraped++;
            }
          }
          console.log(`✅ ${source.name}: ${posts.length} posts`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reddit rate limit
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${source.name} error:`, errorMsg);
        totalErrors++;
        errors.push(`${source.name}: ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;

    await supabase
      .from('javari_data_sources')
      .upsert({
        name: 'news_aggregator',
        source_type: 'api',
        url: 'multiple',
        fetch_frequency: '01:00:00',
        is_active: true,
        last_fetch: new Date().toISOString(),
        error_count: totalErrors,
        last_error: errors.length > 0 ? errors[errors.length - 1] : null,
        config: {
          sources: NEWS_SOURCES.map(s => s.name),
          last_scrape_count: totalScraped,
          last_scrape_duration_ms: duration,
        },
      }, { onConflict: 'name' });

    await logActivity(
      'scrape_news',
      'javari-autonomous-system',
      { scraped: totalScraped, errors: totalErrors, sources: NEWS_SOURCES.length },
      totalErrors === 0,
      errors.length > 0 ? errors.join(', ') : undefined,
      duration
    );

    return NextResponse.json({
      success: true,
      source: 'News Aggregator',
      scraped: totalScraped,
      errors: totalErrors,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fatal error:', error);
    
    await logSelfHealing({
      component: 'news-scraper',
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
