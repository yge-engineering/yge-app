import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/at-a-glance', title: 'At a glance', description: 'Command center tiles.' },
  { href: '/portfolio', title: 'Portfolio', description: 'VP overview.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Daily wake-up tiles.' },
  { href: '/dashboard/today', title: 'Today', description: 'Attention items + cleanup counts.' },
  { href: '/dashboard/yesterday', title: 'Yesterday', description: 'What landed yesterday.' },
  { href: '/dashboard/last-7-days', title: 'Last 7 days', description: 'Past week activity.' },
  { href: '/dashboard/this-month', title: 'This month', description: 'Current month tiles.' },
  { href: '/dashboard/this-quarter', title: 'This quarter', description: 'Quarter snapshot.' },
  { href: '/admin/three-up', title: 'Three-up', description: 'Three big tiles: wins, rate, $.' },
  { href: '/admin/totals', title: 'Totals', description: 'Master table count tiles.' },
  { href: '/admin/landing', title: 'Admin landing', description: 'Minimal entry card grid.' },
  { href: '/dashboard/stats-index', title: 'Stats index', description: 'Mini-stats panel directory.' },
  { href: '/dashboard/all', title: 'All dashboards', description: 'Dashboard variant directory.' },
];

export default function DashboardsRosterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Dashboards roster" subtitle={`${CARDS.length} dashboard / landing variants in one card grid.`} />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
