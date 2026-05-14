import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const RECENTS: Array<{ href: string; label: string; area: string }> = [
  { area: 'Jobs', href: '/jobs/recent', label: 'Recently updated' },
  { area: 'Jobs', href: '/jobs/today', label: 'Touched today' },
  { area: 'Jobs', href: '/jobs/this-week', label: 'This week' },
  { area: 'Jobs', href: '/jobs/this-month', label: 'This month' },
  { area: 'Jobs', href: '/jobs/this-quarter', label: 'This quarter' },
  { area: 'Jobs', href: '/jobs/this-year', label: 'This year' },
  { area: 'Bid results', href: '/bid-results/today', label: 'Today' },
  { area: 'Bid results', href: '/bid-results/this-week', label: 'This week' },
  { area: 'Bid results', href: '/bid-results/last-30-days', label: 'Last 30 days' },
  { area: 'Bid results', href: '/bid-results/this-quarter', label: 'This quarter' },
  { area: 'Bid results', href: '/bid-results/this-year', label: 'This year' },
  { area: 'Customers', href: '/customers/recent', label: 'Recent customers' },
  { area: 'Customers', href: '/customers/today', label: 'Added today' },
  { area: 'Customers', href: '/customers/this-week', label: 'This week' },
  { area: 'Customers', href: '/customers/this-month', label: 'This month' },
  { area: 'Customers', href: '/customers/this-quarter', label: 'This quarter' },
  { area: 'Customers', href: '/customers/this-year', label: 'This year' },
  { area: 'Vendors', href: '/vendors/recent', label: 'Recent vendors' },
  { area: 'Vendors', href: '/vendors/today', label: 'Added today' },
  { area: 'Vendors', href: '/vendors/this-week', label: 'This week' },
  { area: 'Vendors', href: '/vendors/this-month', label: 'This month' },
  { area: 'Vendors', href: '/vendors/this-quarter', label: 'This quarter' },
  { area: 'Vendors', href: '/vendors/this-year', label: 'This year' },
  { area: 'Employees', href: '/employees/recent', label: 'Recent hires' },
  { area: 'Employees', href: '/employees/today', label: 'Hired today' },
  { area: 'Employees', href: '/employees/this-week', label: 'This week' },
  { area: 'Employees', href: '/employees/this-month', label: 'This month' },
  { area: 'Employees', href: '/employees/this-quarter', label: 'This quarter' },
  { area: 'Employees', href: '/employees/this-year', label: 'This year' },
  { area: 'Master data', href: '/materials/recent', label: 'Recent materials' },
  { area: 'Master data', href: '/equipment-rates/recent', label: 'Recent equipment rates' },
  { area: 'Master data', href: '/labor-rates/recent', label: 'Recent labor rates' },
  { area: 'Master data', href: '/cost-codes/recent', label: 'Recent cost codes' },
  { area: 'Master data', href: '/imported-estimates/recent', label: 'Recent estimates' },
  { area: 'Master data', href: '/imported-estimates/today', label: 'Estimates today' },
  { area: 'Master data', href: '/imported-estimates/this-month', label: 'Estimates this month' },
  { area: 'Master data', href: '/imported-estimates/this-quarter', label: 'Estimates this quarter' },
  { area: 'Master data', href: '/imported-estimates/this-year', label: 'Estimates this year' },
  { area: 'Daily reports', href: '/daily-reports/recent', label: 'Recent reports' },
  { area: 'Daily reports', href: '/daily-reports/today', label: 'Today' },
  { area: 'Daily reports', href: '/daily-reports/this-month', label: 'This month' },
  { area: 'Daily reports', href: '/daily-reports/this-year', label: 'This year' },
];

export default function RecentPagesIndexPage() {
  requirePermission('audit:view');
  const groups: Record<string, Array<{ href: string; label: string }>> = {};
  for (const r of RECENTS) {
    if (!groups[r.area]) groups[r.area] = [];
    groups[r.area]!.push({ href: r.href, label: r.label });
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent + time-window pages index" subtitle={`${RECENTS.length} time-window filters indexed by area.`} />
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
