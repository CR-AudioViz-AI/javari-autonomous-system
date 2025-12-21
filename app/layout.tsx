import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Javari AI Autonomous System',
  description: 'Self-learning, self-healing AI infrastructure for CR AudioViz AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
