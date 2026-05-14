import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/jobs/by-status', '/jobs/by-rate-type', '/jobs/by-owner-agency', '/jobs/by-location', '/jobs/by-day-of-week',
  '/jobs/by-month', '/jobs/by-quarter', '/jobs/by-year',
  '/bid-results/by-agency', '/bid-results/by-amount-bucket', '/bid-results/by-bidder-count', '/bid-results/by-day-of-week',
  '/bid-results/by-month', '/bid-results/by-quarter', '/bid-results/by-rank', '/bid-results/by-year',
  '/customers/by-kind', '/customers/by-state', '/customers/by-city', '/customers/by-zip', '/customers/by-payment-terms',
  '/customers/by-state-and-kind', '/customers/by-kind-and-state',
  '/vendors/by-kind', '/vendors/by-state', '/vendors/by-city', '/vendors/by-zip', '/vendors/by-state-and-kind',
  '/employees/by-status', '/employees/by-classification', '/employees/by-tenure',
  '/materials/by-category',
  '/equipment-rates/owned-vs-rental',
  '/labor-rates/by-classification', '/labor-rates/by-rate-type',
  '/cost-codes/by-prefix',
  '/imported-estimates/by-rate-type',
];

export default function AllByPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All by-X grouping pages" subtitle={`${sorted.length} grouping reports, alphabetical.`} />
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
