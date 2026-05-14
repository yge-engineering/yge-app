import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Group { area: string; items: Array<{ href: string; label: string }> }

const GROUPS: Group[] = [
  {
    area: 'Customers',
    items: [
      { href: '/customers/by-kind-detail', label: 'By kind' },
      { href: '/customers/by-state-detail', label: 'By state' },
      { href: '/customers/by-city-detail', label: 'By city' },
      { href: '/customers/by-zip-detail', label: 'By zip' },
      { href: '/customers/by-payment-terms-detail', label: 'By payment terms' },
    ],
  },
  {
    area: 'Vendors',
    items: [
      { href: '/vendors/by-kind-detail', label: 'By kind' },
      { href: '/vendors/by-state-detail', label: 'By state' },
      { href: '/vendors/by-city-detail', label: 'By city' },
      { href: '/vendors/by-zip-detail', label: 'By zip' },
    ],
  },
  {
    area: 'Jobs',
    items: [
      { href: '/jobs/by-status-detail', label: 'By status' },
      { href: '/jobs/by-rate-type-detail', label: 'By rate type' },
      { href: '/jobs/by-owner-agency-detail', label: 'By owner agency' },
      { href: '/jobs/by-location-detail', label: 'By location' },
      { href: '/jobs/by-month-detail', label: 'By month' },
      { href: '/jobs/by-quarter-detail', label: 'By quarter' },
      { href: '/jobs/by-year-detail', label: 'By year' },
    ],
  },
  {
    area: 'Bid results',
    items: [
      { href: '/bid-results/by-agency-detail', label: 'By agency' },
      { href: '/bid-results/by-month-detail', label: 'By month' },
      { href: '/bid-results/by-quarter-detail', label: 'By quarter' },
      { href: '/bid-results/by-year-detail', label: 'By year' },
    ],
  },
  {
    area: 'People',
    items: [
      { href: '/employees/by-status-detail', label: 'By status' },
      { href: '/employees/by-classification-detail', label: 'By classification' },
    ],
  },
  {
    area: 'Master data',
    items: [
      { href: '/materials/by-category-detail', label: 'Materials by category' },
      { href: '/equipment-rates/by-kind-detail', label: 'Equipment by kind' },
      { href: '/labor-rates/by-classification-detail', label: 'Labor by classification' },
      { href: '/cost-codes/by-prefix-detail', label: 'Cost codes by prefix' },
      { href: '/imported-estimates/by-rate-type-detail', label: 'Imported estimates by rate type' },
    ],
  },
  {
    area: 'Admin',
    items: [
      { href: '/admin/data-overview-detail', label: 'Data overview (detail)' },
    ],
  },
];

export default function AllDetailViewsPage() {
  requirePermission('audit:view');
  const total = GROUPS.reduce((sum, g) => sum + g.items.length, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="All detail views" subtitle={`${total} expandable group-by views indexed in one place.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {g.items.map((it) => (
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
