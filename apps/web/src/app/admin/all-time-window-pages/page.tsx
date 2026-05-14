import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/jobs/today', '/jobs/this-week', '/jobs/this-month', '/jobs/this-quarter', '/jobs/this-year',
  '/bid-results/today', '/bid-results/this-week', '/bid-results/last-30-days', '/bid-results/this-quarter', '/bid-results/this-year',
  '/customers/today', '/customers/this-week', '/customers/this-month', '/customers/this-quarter', '/customers/this-year',
  '/vendors/today', '/vendors/this-week', '/vendors/this-month', '/vendors/this-quarter', '/vendors/this-year',
  '/employees/today', '/employees/this-week', '/employees/this-month', '/employees/this-quarter', '/employees/this-year',
  '/imported-estimates/today', '/imported-estimates/this-month', '/imported-estimates/this-quarter', '/imported-estimates/this-year',
  '/daily-reports/today', '/daily-reports/this-month', '/daily-reports/this-year',
];

export default function AllTimeWindowPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All time-window pages" subtitle={`${sorted.length} today / this-week / this-month / this-quarter / this-year filters, alphabetical.`} />
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
