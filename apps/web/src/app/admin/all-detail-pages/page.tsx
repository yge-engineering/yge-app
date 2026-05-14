import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const DETAIL_URLS: string[] = [
  '/jobs/by-status-detail',
  '/jobs/by-owner-agency-detail',
  '/jobs/by-rate-type-detail',
  '/jobs/by-location-detail',
  '/jobs/by-month-detail',
  '/jobs/by-quarter-detail',
  '/jobs/by-year-detail',
  '/bid-results/by-agency-detail',
  '/bid-results/by-month-detail',
  '/bid-results/by-quarter-detail',
  '/bid-results/by-year-detail',
  '/customers/by-kind-detail',
  '/customers/by-state-detail',
  '/customers/by-city-detail',
  '/customers/by-zip-detail',
  '/customers/by-payment-terms-detail',
  '/vendors/by-kind-detail',
  '/vendors/by-state-detail',
  '/vendors/by-city-detail',
  '/vendors/by-zip-detail',
  '/employees/by-status-detail',
  '/employees/by-classification-detail',
  '/materials/by-category-detail',
  '/equipment-rates/by-kind-detail',
  '/labor-rates/by-classification-detail',
  '/cost-codes/by-prefix-detail',
  '/imported-estimates/by-rate-type-detail',
  '/admin/data-overview-detail',
];

export default function AllDetailPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(DETAIL_URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All -detail pages" subtitle={`${sorted.length} expandable group-by views, alphabetical.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-yge-blue-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
