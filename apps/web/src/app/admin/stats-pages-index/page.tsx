import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const STATS_PAGES: Array<{ href: string; label: string; area: string }> = [
  { area: 'Jobs', href: '/jobs/by-status-stats', label: 'By status' },
  { area: 'Jobs', href: '/jobs/by-owner-agency-stats', label: 'By owner agency' },
  { area: 'Jobs', href: '/jobs/by-rate-type-stats', label: 'By rate type' },
  { area: 'Jobs', href: '/jobs/by-location-stats', label: 'By location' },
  { area: 'Jobs', href: '/jobs/this-quarter-stats', label: 'This quarter' },
  { area: 'Jobs', href: '/jobs/this-year-stats', label: 'This year' },
  { area: 'Bid results', href: '/bid-results/by-outcome-stats', label: 'By outcome' },
  { area: 'Bid results', href: '/bid-results/by-agency-stats', label: 'By agency' },
  { area: 'Bid results', href: '/bid-results/this-month-stats', label: 'This month' },
  { area: 'Bid results', href: '/bid-results/this-year-stats', label: 'This year' },
  { area: 'Customers', href: '/customers/by-kind-stats', label: 'By kind' },
  { area: 'Customers', href: '/customers/by-state-stats', label: 'By state' },
  { area: 'Vendors', href: '/vendors/by-kind-stats', label: 'By kind' },
  { area: 'Vendors', href: '/vendors/by-state-stats', label: 'By state' },
  { area: 'Employees', href: '/employees/by-classification-stats', label: 'By classification' },
  { area: 'Materials', href: '/materials/by-category-stats', label: 'By category' },
  { area: 'Cost codes', href: '/cost-codes/by-prefix-stats', label: 'By prefix' },
];

export default function StatsPagesIndexPage() {
  requirePermission('audit:view');
  const groups: Record<string, Array<{ href: string; label: string }>> = {};
  for (const s of STATS_PAGES) {
    if (!groups[s.area]) groups[s.area] = [];
    groups[s.area]!.push({ href: s.href, label: s.label });
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Stats pages index" subtitle={`${STATS_PAGES.length} count-and-share panels indexed by area.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([area, list]) => (
            <section key={area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {list.map((it) => (
                  <li key={it.href} className="px-3 py-2">
                    <Link href={it.href} className="text-yge-blue-700 hover:underline">{it.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{it.href}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
