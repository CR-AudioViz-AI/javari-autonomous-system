# Javari AI Autonomous System

Self-learning, self-healing, and self-reporting infrastructure for Javari AI.

## 🧠 Features

### Knowledge Scrapers
- **DevDocs** - React, TypeScript, JavaScript, Node.js, Next.js, and more
- **MDN** - Web standards documentation (HTML, CSS, JavaScript, Web APIs)
- **FreeCodeCamp** - Tutorial and curriculum content
- **News Aggregator** - HackerNews, Reddit tech communities

### Self-Healing
- Automatic error detection and recovery
- Data source health monitoring
- Queue backlog management
- Stale data cleanup

### Self-Reporting
- Daily comprehensive reports
- Discord notifications (optional)
- Activity logging
- Health metrics

## 📅 Cron Schedule

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/scrape/devdocs` | Every 6 hours | Documentation scraping |
| `/api/scrape/mdn` | 4x daily | Web standards docs |
| `/api/scrape/fcc` | 2x daily | Tutorial content |
| `/api/scrape/news` | Hourly | Tech news aggregation |
| `/api/health/check` | Every 15 min | System monitoring |
| `/api/health/self-heal` | Every 30 min | Auto-recovery |
| `/api/learning/process-queue` | Every 10 min | Knowledge processing |
| `/api/reports/daily` | 6 AM daily | Daily summary |

## 🗄️ Database Tables Used

- `javari_data_sources` - Scraper configuration
- `javari_learning_queue` - Raw content queue
- `javari_knowledge_base` - Processed knowledge
- `javari_self_healing_log` - Issue tracking
- `javari_activity_log` - Activity history
- `javari_external_data` - External data cache

## 🔧 Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret  # For authenticated cron calls
DISCORD_WEBHOOK_URL=optional_discord_webhook  # For notifications
```

## 🚀 Deployment

```bash
npm install
npm run build
npm run start
```

Or deploy to Vercel with Git integration.

## 📊 Manual Testing

Add `?manual=true` to any scraper endpoint to trigger manually:
- `/api/scrape/devdocs?manual=true`
- `/api/scrape/mdn?manual=true`
- etc.

## 🏢 CR AudioViz AI, LLC

Part of the Javari AI autonomous learning ecosystem.
"Your Story. Our Design."
