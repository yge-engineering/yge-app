import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/jobs/by-status-rate-type', title: 'Jobs: status x rate type', description: 'PW vs Private split per status.' },
  { href: '/jobs/by-status-and-year', title: 'Jobs: status x year', description: 'Pipeline migration year over year.' },
  { href: '/customers/by-state-and-kind', title: 'Customers: state x kind', description: 'Geographic + categorical breakdown.' },
  { href: '/customers/by-kind-and-state', title: 'Customers: kind x state', description: 'Same data, transposed.' },
  { href: '/vendors/by-state-and-kind', title: 'Vendors: state x kind', description: 'Sub / supplier coverage by state.' },
  { href: '/bid-results/by-outcome-and-year', title: 'Bid outcomes x year', description: 'Win rate trend across years.' },
];

export default function CrossTabsIndexPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Cross-tab index" subtitle={`${CARDS.length} two-dimensional grids for slicing the data.`} />
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
