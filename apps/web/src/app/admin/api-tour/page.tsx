// /admin/api-tour — quick reference of API endpoints added overnight.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface ApiGroup {
  title: string;
  endpoints: Array<{ method: string; path: string; blurb: string }>;
}

const GROUPS: ApiGroup[] = [
  {
    title: 'Customers',
    endpoints: [
      { method: 'GET', path: '/api/customers/export.csv', blurb: 'Full master list as CSV.' },
      { method: 'POST', path: '/api/customers/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/customers/search?q=…', blurb: 'Live search.' },
      { method: 'GET', path: '/api/customers/touchpoints', blurb: 'Dormancy ranking.' },
      { method: 'GET', path: '/api/customers/revenue-concentration', blurb: 'Revenue share + HHI.' },
      { method: 'GET', path: '/api/customers/:id/rollup', blurb: 'Per-customer rollup.' },
    ],
  },
  {
    title: 'Vendors / subs',
    endpoints: [
      { method: 'GET', path: '/api/vendors/export.csv', blurb: 'Full vendor master.' },
      { method: 'POST', path: '/api/vendors/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/vendors/search?q=…', blurb: 'Live search.' },
      { method: 'GET', path: '/api/vendors/scorecard?kind=SUBCONTRACTOR', blurb: 'Pay performance per sub.' },
      { method: 'GET', path: '/api/vendors/coi-aging', blurb: 'COI expiration tracking.' },
    ],
  },
  {
    title: 'Cost codes / rates',
    endpoints: [
      { method: 'GET', path: '/api/cost-codes/export.csv', blurb: 'Master code list.' },
      { method: 'POST', path: '/api/cost-codes/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/cost-codes/search?q=…', blurb: 'Live search.' },
      { method: 'GET', path: '/api/cost-codes/stats', blurb: 'Top spend per code.' },
      { method: 'GET', path: '/api/cost-codes/trends', blurb: 'Climbing / falling prices.' },
      { method: 'GET', path: '/api/cost-codes/:code/history', blurb: 'Recent bid prices for a code.' },
      { method: 'GET', path: '/api/cost-codes/:code/resolve', blurb: 'Look up master unit cost.' },
      { method: 'GET', path: '/api/labor-rates/export.csv', blurb: 'Labor master list.' },
      { method: 'GET', path: '/api/materials/export.csv', blurb: 'Materials master.' },
      { method: 'POST', path: '/api/materials/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/materials/staleness', blurb: 'Re-quote chase list.' },
      { method: 'GET', path: '/api/equipment-rates/export.csv', blurb: 'Equipment master.' },
      { method: 'POST', path: '/api/equipment-rates/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/equipment-rates/usage', blurb: 'Per-piece bid vs actual.' },
    ],
  },
  {
    title: 'Jobs',
    endpoints: [
      { method: 'GET', path: '/api/jobs/export.csv', blurb: 'Full job list.' },
      { method: 'GET', path: '/api/jobs/stats', blurb: 'Count by status.' },
      { method: 'GET', path: '/api/jobs/stats/by-year', blurb: 'YoY job counts.' },
      { method: 'GET', path: '/api/jobs/pipeline-forecast', blurb: 'Risk-adjusted open $.' },
      { method: 'GET', path: '/api/jobs/:id/budget-actual', blurb: 'Budget vs actual.' },
      { method: 'GET', path: '/api/jobs/:id/cost-code-variance', blurb: 'Per-code variance.' },
      { method: 'GET', path: '/api/jobs/:id/cost-lines.csv', blurb: 'All daily lines CSV.' },
    ],
  },
  {
    title: 'Estimates',
    endpoints: [
      { method: 'GET', path: '/api/imported-estimates/export.csv', blurb: 'Estimate summary CSV.' },
      { method: 'GET', path: '/api/imported-estimates/search?q=…', blurb: 'Full-text search.' },
      { method: 'GET', path: '/api/imported-estimates/audits-summary', blurb: 'Per-estimate audit counts.' },
      { method: 'GET', path: '/api/imported-estimates/:id', blurb: 'Estimate detail.' },
      { method: 'GET', path: '/api/imported-estimates/:id/audit', blurb: 'Price audit findings.' },
      { method: 'GET', path: '/api/imported-estimates/:id/excel.xlsx', blurb: 'Excel export.' },
      { method: 'POST', path: '/api/imported-estimates/:id/clone', blurb: 'Clone to new bid.' },
      { method: 'POST', path: '/api/imported-estimates/:id/snapshot', blurb: 'Save snapshot.' },
      { method: 'POST', path: '/api/imported-estimates/:id/restore/:snapshotId', blurb: 'Restore snapshot.' },
      { method: 'POST', path: '/api/imported-estimates/:id/convert-to-job', blurb: 'Create linked Job.' },
      { method: 'POST', path: '/api/imported-estimates/:id/reset-prices', blurb: 'Zero all line prices.' },
      { method: 'POST', path: '/api/imported-estimates/:id/mark-submitted', blurb: 'Stamp submitted.' },
    ],
  },
  {
    title: 'Bid results',
    endpoints: [
      { method: 'GET', path: '/api/bid-results/export.csv', blurb: 'CSV export.' },
      { method: 'POST', path: '/api/bid-results/import-csv', blurb: 'Bulk import.' },
      { method: 'GET', path: '/api/bid-results/by-agency', blurb: 'Win rate per agency.' },
      { method: 'GET', path: '/api/bid-results/stats', blurb: 'Lifetime + per-year stats.' },
      { method: 'GET', path: '/api/bid-results/stats/sparkline', blurb: 'Monthly buckets.' },
    ],
  },
  {
    title: 'Daily reports',
    endpoints: [
      { method: 'GET', path: '/api/imported-daily-reports/today', blurb: 'Today\'s cost lines.' },
      { method: 'GET', path: '/api/imported-daily-reports/range', blurb: 'Date-range query.' },
      { method: 'POST', path: '/api/imported-daily-reports/quick-log', blurb: 'Append one line.' },
    ],
  },
  {
    title: 'Admin / health',
    endpoints: [
      { method: 'GET', path: '/health/version', blurb: 'Deployed commit SHA.' },
      { method: 'GET', path: '/api/admin/data-status/counts', blurb: 'Master-data row counts.' },
      { method: 'GET', path: '/api/company-info', blurb: 'YGE legal/contact facts.' },
      { method: 'GET', path: '/api/employees/utilization?weeks=N', blurb: 'Weekly labor totals.' },
      { method: 'GET', path: '/api/employees/export.csv', blurb: 'Staff CSV.' },
    ],
  },
];

export default function ApiTourPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="API tour"
          subtitle={`${GROUPS.reduce((s, g) => s + g.endpoints.length, 0)} endpoints shipped overnight, grouped by domain.`}
        />
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <section key={g.title} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">{g.title}</h2>
              <ul className="space-y-2 text-xs">
                {g.endpoints.map((e) => (
                  <li key={e.path} className="flex flex-wrap items-baseline gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono font-semibold ${e.method === 'GET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{e.method}</span>
                    <span className="font-mono text-gray-900">{e.path}</span>
                    <span className="text-gray-600">— {e.blurb}</span>
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
