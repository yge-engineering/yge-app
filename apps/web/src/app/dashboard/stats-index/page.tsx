import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/jobs/by-status-stats', title: 'Jobs by status — stats', description: 'Count + share per status.' },
  { href: '/jobs/this-quarter-stats', title: 'Jobs — this quarter stats', description: 'Status breakdown for current quarter.' },
  { href: '/jobs/this-year-stats', title: 'Jobs — this year stats', description: 'Status breakdown for current year.' },
  { href: '/bid-results/by-outcome-stats', title: 'Bid results by outcome — stats', description: 'Count + share per outcome.' },
  { href: '/bid-results/this-month-stats', title: 'Bid results — this month stats', description: 'Outcome breakdown + won $ for current month.' },
  { href: '/bid-results/this-year-stats', title: 'Bid results — this year stats', description: 'Outcome tiles + won $ for current year.' },
  { href: '/admin/cleanup-progress', title: 'Cleanup progress', description: 'Coverage % per cleanable field.' },
  { href: '/admin/data-quality-counts', title: 'Data-quality counts', description: 'Counts of every missing-* bucket.' },
];

export default function StatsIndexPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Stats index" subtitle={`${CARDS.length} mini-stats panels for the current period.`} />
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
