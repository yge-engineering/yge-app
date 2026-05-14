import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/admin/pipeline-snapshot', title: 'Pipeline snapshot', description: 'Jobs per pipeline stage.' },
  { href: '/admin/outcome-snapshot', title: 'Outcome snapshot', description: 'Bids per outcome bucket.' },
  { href: '/admin/totals', title: 'Totals', description: 'Master table record counts.' },
  { href: '/admin/three-up', title: 'Three-up', description: 'Wins / rate / won $ giant tiles.' },
  { href: '/admin/data-summary', title: 'Data summary', description: 'Record-count tile dashboard.' },
  { href: '/admin/landing', title: 'Admin landing', description: 'Entry card grid.' },
  { href: '/dashboard/today', title: 'Today', description: 'Attention items + cleanup.' },
  { href: '/dashboard/this-month', title: 'This month', description: 'Current month tiles.' },
  { href: '/dashboard/this-quarter', title: 'This quarter', description: 'Quarter snapshot.' },
  { href: '/dashboard/yesterday', title: 'Yesterday', description: 'Yesterday tiles.' },
  { href: '/dashboard/last-7-days', title: 'Last 7 days', description: 'Past week activity.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Pipeline + bid history snapshot.' },
];

export default function SnapshotsIndexPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Snapshots index" subtitle="Pages whose layout is mostly tiles or one-glance summaries." />
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
