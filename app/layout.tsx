// app/layout.tsx — server-rendered brand shell
// CR AudioViz AI · EIN: 39-3646201 · May 2026
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  // 2026-08-16: the icons and share card existed in public/ but nothing pointed
  // at them, so every share rendered as a blank grey rectangle and every tab
  // showed a default globe.
  icons: {
    icon: [{ url: '/favicon.png', sizes: '32x32' }, { url: '/icon-512.png', sizes: '512x512' }],
    apple: '/apple-touch-icon.png',
  },
  // 2026-08-16: no metadataBase meant relative og:image paths resolved against
  // the preview hostname, and no canonical meant a trailing slash, a query
  // string and a preview host all competed for the same content.
  metadataBase: new URL('https://autonomous.craudiovizai.com'),
  alternates: { canonical: '/' },
  title: 'Javari Autonomous',
  description: 'AI autonomous system management and workflow orchestration.',
  // 2026-08-16: merged rather than added — a second openGraph key is a
  // duplicate object property and fails the TypeScript build.
  openGraph: {
    title: 'Javari Autonomous',
    description: 'AI autonomous system management and workflow orchestration.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 200 }}>
          <a href="https://craudiovizai.com" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <span>🤖</span>
            <span style={{ color: '#7c3aed' }}>Javari Autonomous</span>
            <span style={{ color: '#374151', fontSize: 11, marginLeft: 4 }}>· CR AudioViz AI · EIN 39-3646201</span>
          </a>
          <a href="https://craudiovizai.com/auth/signup" style={{ background: '#7c3aed', color: '#000', borderRadius: 6, padding: '4px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            Enterprise →
          </a>
        </div>
        {children}
        <footer style={{ background: '#050608', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ color: '#1f2937', fontSize: 11, margin: 0, fontFamily: 'system-ui' }}>
            © 2026 CR AudioViz AI, LLC — EIN: 39-3646201 · Fort Myers, Florida · Your Story. Our Design. ·{' '}
            <a href="https://craudiovizai.com" style={{ color: '#374151', textDecoration: 'none' }}>craudiovizai.com</a>
            {' '}·{' '}
            <a href="https://craudiovizai.com/auth/signup" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>Sign Up Free</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
