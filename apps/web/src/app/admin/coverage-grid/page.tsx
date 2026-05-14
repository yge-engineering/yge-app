import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row {
  area: string;
  stats?: string;
  detail?: string;
  missing?: string;
  withIt?: string;
  recent?: string;
  windows?: string;
}

const ROWS: Row[] = [
  { area: 'Jobs', stats: '/jobs/by-status-stats', detail: '/jobs/by-status-detail', missing: '/jobs/missing-status', withIt: '/jobs/with-status', recent: '/jobs/recent', windows: '/jobs/this-year' },
  { area: 'Bid results', stats: '/bid-results/by-outcome-stats', detail: '/bid-results/by-agency-detail', recent: '/bid-results/this-week', windows: '/bid-results/this-year' },
  { area: 'Customers', stats: '/customers/by-kind-stats', detail: '/customers/by-kind-detail', missing: '/customers/missing-email', withIt: '/customers/with-email', recent: '/customers/recent', windows: '/customers/this-year' },
  { area: 'Vendors', stats: '/vendors/by-kind-stats', detail: '/vendors/by-kind-detail', missing: '/vendors/missing-email', withIt: '/vendors/with-email', recent: '/vendors/recent', windows: '/vendors/this-year' },
  { area: 'Employees', stats: '/employees/by-classification-stats', detail: '/employees/by-classification-detail', missing: '/employees/missing-classification', withIt: '/employees/with-classification', recent: '/employees/recent', windows: '/employees/this-year' },
  { area: 'Materials', stats: '/materials/by-category-stats', detail: '/materials/by-category-detail', recent: '/materials/recent' },
  { area: 'Equipment rates', detail: '/equipment-rates/by-kind-detail', recent: '/equipment-rates/recent' },
  { area: 'Labor rates', detail: '/labor-rates/by-classification-detail', recent: '/labor-rates/recent' },
  { area: 'Cost codes', stats: '/cost-codes/by-prefix-stats', detail: '/cost-codes/by-prefix-detail', recent: '/cost-codes/recent' },
  { area: 'Imported estimates', detail: '/imported-estimates/by-rate-type-detail', recent: '/imported-estimates/recent', windows: '/imported-estimates/this-year' },
  { area: 'Daily reports', recent: '/daily-reports/recent', windows: '/daily-reports/this-year' },
];

function cell(href?: string) {
  return href ? <Link href={href} className="text-yge-blue-700 hover:underline">✓</Link> : <span className="text-gray-300">—</span>;
}

export default function CoverageGridPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Coverage grid" subtitle="Which page patterns each entity has, at a glance." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2 text-center">stats</th>
                <th className="px-3 py-2 text-center">detail</th>
                <th className="px-3 py-2 text-center">missing-X</th>
                <th className="px-3 py-2 text-center">with-X</th>
                <th className="px-3 py-2 text-center">recent</th>
                <th className="px-3 py-2 text-center">time windows</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.area} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{r.area}</td>
                  <td className="px-3 py-2 text-center">{cell(r.stats)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.detail)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.missing)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.withIt)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.recent)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.windows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
