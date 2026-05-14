import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const DETAIL_PAGES: Array<{ area: string; href: string; label: string }> = [
  { area: 'Jobs', href: '/jobs/by-status-detail', label: 'By status' },
  { area: 'Jobs', href: '/jobs/by-owner-agency-detail', label: 'By owner agency' },
  { area: 'Jobs', href: '/jobs/by-rate-type-detail', label: 'By rate type' },
  { area: 'Jobs', href: '/jobs/by-location-detail', label: 'By location' },
  { area: 'Jobs', href: '/jobs/by-month-detail', label: 'By month' },
  { area: 'Jobs', href: '/jobs/by-quarter-detail', label: 'By quarter' },
  { area: 'Jobs', href: '/jobs/by-year-detail', label: 'By year' },
  { area: 'Bid results', href: '/bid-results/by-agency-detail', label: 'By agency' },
  { area: 'Bid results', href: '/bid-results/by-month-detail', label: 'By month' },
  { area: 'Bid results', href: '/bid-results/by-quarter-detail', label: 'By quarter' },
  { area: 'Bid results', href: '/bid-results/by-year-detail', label: 'By year' },
  { area: 'Customers', href: '/customers/by-kind-detail', label: 'By kind' },
  { area: 'Customers', href: '/customers/by-state-detail', label: 'By state' },
  { area: 'Customers', href: '/customers/by-city-detail', label: 'By city' },
  { area: 'Customers', href: '/customers/by-zip-detail', label: 'By zip' },
  { area: 'Customers', href: '/customers/by-payment-terms-detail', label: 'By payment terms' },
  { area: 'Vendors', href: '/vendors/by-kind-detail', label: 'By kind' },
  { area: 'Vendors', href: '/vendors/by-state-detail', label: 'By state' },
  { area: 'Vendors', href: '/vendors/by-city-detail', label: 'By city' },
  { area: 'Vendors', href: '/vendors/by-zip-detail', label: 'By zip' },
  { area: 'Employees', href: '/employees/by-status-detail', label: 'By status' },
  { area: 'Employees', href: '/employees/by-classification-detail', label: 'By classification' },
  { area: 'Master data', href: '/materials/by-category-detail', label: 'Materials by category' },
  { area: 'Master data', href: '/equipment-rates/by-kind-detail', label: 'Equipment by kind' },
  { area: 'Master data', href: '/labor-rates/by-classification-detail', label: 'Labor by classification' },
  { area: 'Master data', href: '/cost-codes/by-prefix-detail', label: 'Cost codes by prefix' },
  { area: 'Master data', href: '/imported-estimates/by-rate-type-detail', label: 'Estimates by rate type' },
  { area: 'Admin', href: '/admin/data-overview-detail', label: 'Data overview' },
];

export default function DetailPagesIndexPage() {
  requirePermission('audit:view');
  const groups: Record<string, Array<{ href: string; label: string }>> = {};
  for (const d of DETAIL_PAGES) {
    if (!groups[d.area]) groups[d.area] = [];
    groups[d.area]!.push({ href: d.href, label: d.label });
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Detail pages index" subtitle={`${DETAIL_PAGES.length} expandable group-by views indexed by area.`} />
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
