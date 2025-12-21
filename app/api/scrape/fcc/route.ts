import { NextRequest, NextResponse } from 'next/server';
import { supabase, logActivity, addToLearningQueue, logSelfHealing } from '@/lib/supabase';

const FCC_API = 'https://www.freecodecamp.org';
const FCC_CURRICULUM_API = 'https://api.freecodecamp.org/api/curriculum';

const CURRICULUMS = [
  { name: 'Responsive Web Design', slug: 'responsive-web-design' },
  { name: 'JavaScript Algorithms', slug: 'javascript-algorithms-and-data-structures' },
  { name: 'Front End Libraries', slug: 'front-end-development-libraries' },
  { name: 'Data Visualization', slug: 'data-visualization' },
  { name: 'APIs and Microservices', slug: 'back-end-development-and-apis' },
  { name: 'Quality Assurance', slug: 'quality-assurance' },
  { name: 'Scientific Computing Python', slug: 'scientific-computing-with-python' },
  { name: 'Data Analysis Python', slug: 'data-analysis-with-python' },
  { name: 'Machine Learning Python', slug: 'machine-learning-with-python' },
  { name: 'Relational Database', slug: 'relational-database' },
  { name: 'Information Security', slug: 'information-security' },
  { name: 'Coding Interview Prep', slug: 'coding-interview-prep' },
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
    console.log('🚀 FreeCodeCamp scraper started');

    await supabase
      .from('javari_data_sources')
      .upsert({
        name: 'freecodecamp',
        source_type: 'scrape',
        url: FCC_API,
        fetch_frequency: '12:00:00',
        is_active: true,
        last_fetch: new Date().toISOString(),
        config: { curriculums: CURRICULUMS.map(c => c.slug) },
      }, { onConflict: 'name' });

    // Scrape each curriculum
    for (const curriculum of CURRICULUMS) {
      try {
        console.log(`📚 Scraping FCC: ${curriculum.name}`);
        
        // Add curriculum metadata to learning queue
        await addToLearningQueue(
          'freecodecamp',
          'curriculum',
          JSON.stringify({
            name: curriculum.name,
            slug: curriculum.slug,
            url: `${FCC_API}/learn/${curriculum.slug}`,
            type: 'certification_path',
          }),
          7
        );
        totalScraped++;

        // FCC doesn't have a public API for curriculum content
        // We'll add metadata for the learning processor to handle
        const sections = getCurriculumSections(curriculum.slug);
        
        for (const section of sections) {
          await addToLearningQueue(
            'freecodecamp',
            'tutorial',
            JSON.stringify({
              curriculum: curriculum.name,
              section: section.name,
              url: `${FCC_API}/learn/${curriculum.slug}/${section.slug}`,
              type: section.type,
            }),
            6
          );
          totalScraped++;
        }

        console.log(`✅ Completed FCC ${curriculum.name}`);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error scraping FCC ${curriculum.name}:`, errorMsg);
        totalErrors++;
        errors.push(`${curriculum.name}: ${errorMsg}`);
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
          curriculums: CURRICULUMS.map(c => c.slug),
          last_scrape_duration_ms: duration,
          last_scrape_count: totalScraped,
        },
      })
      .eq('name', 'freecodecamp');

    await logActivity(
      'scrape_fcc',
      'javari-autonomous-system',
      { scraped: totalScraped, errors: totalErrors },
      totalErrors === 0,
      errors.length > 0 ? errors.join(', ') : undefined,
      duration
    );

    return NextResponse.json({
      success: true,
      source: 'FreeCodeCamp',
      scraped: totalScraped,
      errors: totalErrors,
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fatal error:', error);
    
    await logSelfHealing({
      component: 'fcc-scraper',
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

function getCurriculumSections(slug: string): Array<{ name: string; slug: string; type: string }> {
  // Predefined sections for each curriculum
  const sections: Record<string, Array<{ name: string; slug: string; type: string }>> = {
    'responsive-web-design': [
      { name: 'Learn HTML by Building a Cat Photo App', slug: 'learn-html-by-building-a-cat-photo-app', type: 'project' },
      { name: 'Learn Basic CSS', slug: 'learn-basic-css-by-building-a-cafe-menu', type: 'project' },
      { name: 'CSS Colors', slug: 'learn-css-colors-by-building-a-set-of-colored-markers', type: 'project' },
      { name: 'HTML Forms', slug: 'learn-html-forms-by-building-a-registration-form', type: 'project' },
      { name: 'CSS Box Model', slug: 'learn-the-css-box-model-by-building-a-rothko-painting', type: 'project' },
    ],
    'javascript-algorithms-and-data-structures': [
      { name: 'Basic JavaScript', slug: 'basic-javascript', type: 'lessons' },
      { name: 'ES6', slug: 'es6', type: 'lessons' },
      { name: 'Regular Expressions', slug: 'regular-expressions', type: 'lessons' },
      { name: 'Debugging', slug: 'debugging', type: 'lessons' },
      { name: 'Basic Data Structures', slug: 'basic-data-structures', type: 'lessons' },
      { name: 'Basic Algorithm Scripting', slug: 'basic-algorithm-scripting', type: 'challenges' },
      { name: 'OOP', slug: 'object-oriented-programming', type: 'lessons' },
      { name: 'Functional Programming', slug: 'functional-programming', type: 'lessons' },
      { name: 'Intermediate Algorithm Scripting', slug: 'intermediate-algorithm-scripting', type: 'challenges' },
    ],
    'front-end-development-libraries': [
      { name: 'Bootstrap', slug: 'bootstrap', type: 'lessons' },
      { name: 'jQuery', slug: 'jquery', type: 'lessons' },
      { name: 'Sass', slug: 'sass', type: 'lessons' },
      { name: 'React', slug: 'react', type: 'lessons' },
      { name: 'Redux', slug: 'redux', type: 'lessons' },
      { name: 'React and Redux', slug: 'react-and-redux', type: 'lessons' },
    ],
    'data-visualization': [
      { name: 'D3', slug: 'd3', type: 'lessons' },
      { name: 'JSON APIs and AJAX', slug: 'json-apis-and-ajax', type: 'lessons' },
    ],
    'back-end-development-and-apis': [
      { name: 'Managing Packages with NPM', slug: 'managing-packages-with-npm', type: 'lessons' },
      { name: 'Basic Node and Express', slug: 'basic-node-and-express', type: 'lessons' },
      { name: 'MongoDB and Mongoose', slug: 'mongodb-and-mongoose', type: 'lessons' },
    ],
  };

  return sections[slug] || [{ name: 'Overview', slug: '', type: 'overview' }];
}
