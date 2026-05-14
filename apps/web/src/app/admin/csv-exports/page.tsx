import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const EXPORTS = [
  { path: '/api/customers/export.csv', title: 'Customers' },
  { path: '/api/vendors/export.csv', title: 'Vendors / subs' },
  { path: '/api/materials/export.csv', title: 'Materials' },
  { path: '/api/equipment-rates/export.csv', title: 'Equipment rates' },
  { path: '/api/cost-codes/export.csv', title: 'Cost codes' },
  { path: '/api/labor-rates/export.csv', title: 'Labor rates' },
  { path: '/api/employees/export.csv', title: 'Employees' },
  { path: '/api/jobs/export.csv', title: 'Jobs' },
  { path: '/api/imported-estimates/export.csv', title: 'Imported estimates' },
  { path: '/api/bid-results/export.csv', title: 'Bid results' },
  { path: '/api/imported-daily-reports/export.csv', title: 'Daily reports — all lines' },
];

export default function CsvExportsHubPage() {
  requirePermission('audit:view');
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="CSV exports" subtitle="One-click downloads of every master entity." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {EXPORTS.map((e) => (
            <li key={e.path} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-gray-900">{e.title}</span>
              <a
                href={`${apiBase}${e.path}`}
                download
                className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
              >
                Download CSV
              </a>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
