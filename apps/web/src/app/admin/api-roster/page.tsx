import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Endpoint { method: string; path: string; description: string }

interface Group { area: string; items: Endpoint[] }

const GROUPS: Group[] = [
  {
    area: 'Jobs',
    items: [
      { method: 'GET', path: '/api/jobs', description: 'List every job' },
      { method: 'GET', path: '/api/jobs/stats', description: 'Total + per-status + per-rateType counts' },
      { method: 'GET', path: '/api/jobs/stats/by-year', description: 'YoY job counts' },
      { method: 'GET', path: '/api/jobs/stats/awarded-revenue', description: 'Awarded revenue per year' },
      { method: 'POST', path: '/api/jobs', description: 'Create a job' },
    ],
  },
  {
    area: 'Bid results',
    items: [
      { method: 'GET', path: '/api/bid-results', description: 'List every bid result' },
      { method: 'GET', path: '/api/bid-results/stats', description: 'Lifetime + per-year stats' },
      { method: 'GET', path: '/api/bid-results/stats/sparkline', description: 'Month buckets' },
      { method: 'GET', path: '/api/bid-results/by-agency', description: 'Per-agency win rates' },
      { method: 'POST', path: '/api/bid-results/import-csv', description: 'Bulk import CSV' },
      { method: 'GET', path: '/api/bid-results/export.csv', description: 'Export CSV' },
    ],
  },
  {
    area: 'Master data',
    items: [
      { method: 'GET', path: '/api/customers', description: 'List customers' },
      { method: 'GET', path: '/api/customers/email-list', description: 'BCC-ready email list' },
      { method: 'GET', path: '/api/vendors', description: 'List vendors' },
      { method: 'GET', path: '/api/vendors/email-list', description: 'Vendor BCC list' },
      { method: 'GET', path: '/api/vendors/scorecard', description: 'Vendor scorecard' },
      { method: 'GET', path: '/api/employees', description: 'List employees' },
      { method: 'GET', path: '/api/employees/utilization', description: 'Active / total ratio' },
      { method: 'GET', path: '/api/materials', description: 'List materials' },
      { method: 'GET', path: '/api/equipment-rates', description: 'List owned + rental rates' },
      { method: 'GET', path: '/api/equipment-rates/usage', description: 'Equipment usage on bid + actual' },
      { method: 'GET', path: '/api/labor-rates', description: 'List labor rates' },
      { method: 'GET', path: '/api/cost-codes', description: 'List cost codes' },
      { method: 'GET', path: '/api/imported-estimates', description: 'List imported estimates' },
      { method: 'GET', path: '/api/imported-daily-reports', description: 'List daily reports' },
    ],
  },
  {
    area: 'Admin',
    items: [
      { method: 'GET', path: '/api/admin/health', description: 'API health snapshot' },
      { method: 'GET', path: '/api/admin/data-status', description: 'Record counts per entity' },
    ],
  },
];

export default function ApiRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="API roster" subtitle="Public API endpoints, grouped by area. Read-only documentation." />
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <section key={g.area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
                {g.items.map((it, i) => (
                  <li key={i} className="flex flex-col gap-1 px-3 py-2 text-sm md:flex-row md:items-baseline md:gap-3">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${it.method === 'GET' ? 'bg-blue-100 text-blue-800' : it.method === 'POST' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{it.method}</span>
                    <span className="font-mono text-xs text-gray-900">{it.path}</span>
                    <span className="text-xs text-gray-600 md:ml-auto">{it.description}</span>
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
