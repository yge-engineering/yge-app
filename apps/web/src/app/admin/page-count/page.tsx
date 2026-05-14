import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface AreaCount { area: string; count: number }

// Rough hand-curated index of pages per area. Updated when major surfaces ship.
const COUNTS: AreaCount[] = [
  { area: 'Dashboard / landing', count: 9 },
  { area: 'Jobs', count: 26 },
  { area: 'Bid results', count: 25 },
  { area: 'Customers', count: 18 },
  { area: 'Vendors', count: 18 },
  { area: 'Employees', count: 13 },
  { area: 'Materials / equipment / labor rates / cost codes', count: 17 },
  { area: 'Imported estimates / daily reports', count: 12 },
  { area: 'Admin', count: 38 },
  { area: 'Help / meta', count: 11 },
];

export default function PageCountPage() {
  requirePermission('audit:view');
  const total = COUNTS.reduce((s, r) => s + r.count, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Page count" subtitle="Approximate page count per area. Updated by hand when major surfaces ship." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2 text-right">Pages</th>
                <th className="px-3 py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {COUNTS.map((r) => (
                <tr key={r.area} className="border-t border-gray-100">
                  <td className="px-3 py-2">{r.area}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{((r.count / total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono">{total}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Counts include analytic views, hubs, data-quality cleanup, time-window filters, and admin tools.
        </p>
      </main>
    </AppShell>
  );
}
