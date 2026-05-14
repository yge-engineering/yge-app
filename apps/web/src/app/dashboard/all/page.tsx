import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/dashboard/today', title: 'Today', description: 'Attention items + cleanup counts for right now.' },
  { href: '/dashboard/last-7-days', title: 'Last 7 days', description: 'Cross-module activity for the past week.' },
  { href: '/dashboard/this-month', title: 'This month', description: 'Bids tracked, wins, won $ for the calendar month.' },
  { href: '/dashboard/this-quarter', title: 'This quarter', description: 'Quarter-aligned bid + job activity.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Pipeline + bid history snapshot.' },
  { href: '/portfolio', title: 'Portfolio', description: 'Lifetime view of the company across modules.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page in one list.' },
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index, organized by area.' },
];

export default function AllDashboardsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="All dashboards" subtitle="Every dashboard variant in one card grid." />
        <div className="grid gap-3 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
