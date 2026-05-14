import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const STATS_URLS: string[] = [
  '/jobs/by-status-stats',
  '/jobs/by-owner-agency-stats',
  '/jobs/by-rate-type-stats',
  '/jobs/by-location-stats',
  '/jobs/by-month-stats',
  '/jobs/this-quarter-stats',
  '/jobs/this-year-stats',
  '/bid-results/by-outcome-stats',
  '/bid-results/by-agency-stats',
  '/bid-results/by-month-stats',
  '/bid-results/this-month-stats',
  '/bid-results/this-year-stats',
  '/customers/by-kind-stats',
  '/customers/by-state-stats',
  '/vendors/by-kind-stats',
  '/vendors/by-state-stats',
  '/employees/by-classification-stats',
  '/materials/by-category-stats',
  '/cost-codes/by-prefix-stats',
];

export default function AllStatsPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(STATS_URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All -stats pages" subtitle={`${sorted.length} count-and-share panels, alphabetical.`} />
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
