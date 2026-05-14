import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/at-a-glance', title: 'At a glance', description: 'Open me first.' },
  { href: '/portfolio', title: 'Portfolio', description: 'Lifetime + pipeline + masters.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Daily wake-up tiles.' },
  { href: '/admin/yge-context', title: 'YGE context', description: 'New-viewer orientation.' },
  { href: '/admin/quick-look', title: 'Quick look', description: 'Plain-English summary of the app.' },
  { href: '/admin/grand-index', title: 'Grand index', description: 'Every landing + hub catalog.' },
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic view in one list.' },
  { href: '/help', title: 'Help', description: 'FAQ + glossary + cheat sheet.' },
];

export default function AdminLandingPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Admin landing" subtitle="A minimal entrypoint for first-time visitors. Open At a glance first." />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-2 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
