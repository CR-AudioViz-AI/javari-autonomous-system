export default function Home() {
  return (
    <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
        🧠 Javari AI Autonomous System
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '40px' }}>
        Self-learning, self-healing AI infrastructure for CR AudioViz AI
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Scrapers Section */}
        <section style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📚 Knowledge Scrapers
          </h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><a href="/api/scrape/devdocs?manual=true" style={{ color: '#60a5fa' }}>DevDocs Scraper</a> - React, TypeScript, Node.js docs</li>
            <li><a href="/api/scrape/mdn?manual=true" style={{ color: '#60a5fa' }}>MDN Scraper</a> - Web standards documentation</li>
            <li><a href="/api/scrape/fcc?manual=true" style={{ color: '#60a5fa' }}>FreeCodeCamp Scraper</a> - Tutorial content</li>
            <li><a href="/api/scrape/news?manual=true" style={{ color: '#60a5fa' }}>News Aggregator</a> - Tech news &amp; trends</li>
          </ul>
        </section>

        {/* Health Section */}
        <section style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔧 Health &amp; Self-Healing
          </h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><a href="/api/health/check" style={{ color: '#60a5fa' }}>Health Check</a> - System status overview</li>
            <li><a href="/api/health/self-heal" style={{ color: '#60a5fa' }}>Self-Heal</a> - Automatic issue resolution</li>
          </ul>
        </section>

        {/* Learning Section */}
        <section style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🧠 Learning Pipeline
          </h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><a href="/api/learning/process-queue" style={{ color: '#60a5fa' }}>Process Queue</a> - Convert scraped data to knowledge</li>
          </ul>
        </section>

        {/* Reports Section */}
        <section style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Reports
          </h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><a href="/api/reports/daily" style={{ color: '#60a5fa' }}>Daily Report</a> - 24-hour summary</li>
          </ul>
        </section>
      </div>

      <section style={{ marginTop: '40px', background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>⏰ Cron Schedule</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Endpoint</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Schedule</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/scrape/devdocs</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>Every 6 hours</td>
              <td style={{ padding: '8px' }}>Scrape DevDocs documentation</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/scrape/mdn</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>4x daily</td>
              <td style={{ padding: '8px' }}>Scrape MDN Web Docs</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/scrape/fcc</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>2x daily</td>
              <td style={{ padding: '8px' }}>Scrape FreeCodeCamp curriculum</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/scrape/news</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>Hourly</td>
              <td style={{ padding: '8px' }}>Aggregate tech news</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/health/check</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>Every 15 min</td>
              <td style={{ padding: '8px' }}>System health monitoring</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/health/self-heal</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>Every 30 min</td>
              <td style={{ padding: '8px' }}>Automatic issue resolution</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <td style={{ padding: '8px' }}>/api/learning/process-queue</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>Every 10 min</td>
              <td style={{ padding: '8px' }}>Process learning queue</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>/api/reports/daily</td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>6 AM daily</td>
              <td style={{ padding: '8px' }}>Generate daily report</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#64748b' }}>
        <p>CR AudioViz AI, LLC • Javari AI Autonomous System v1.0</p>
        <p style={{ marginTop: '8px' }}>🤖 Learning. Healing. Evolving.</p>
      </footer>
    </main>
  );
}
