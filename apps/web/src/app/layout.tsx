import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

// Manrope was picked over Inter for readability: rounder, more open
// letterforms hold up better at small sizes for the dense table-heavy
// pages (estimates, daily reports, AP/AR aging). Variable weight is
// loaded so we don't pay for multiple files.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-yge-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YGE App — Young General Engineering',
  description: 'Estimating, job management, and bookkeeping for Young General Engineering, Inc.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'YGE',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-screen bg-gray-50 font-sans text-[15px] leading-relaxed antialiased">{children}</body>
    </html>
  );
}
