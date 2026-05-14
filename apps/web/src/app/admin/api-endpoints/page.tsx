import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Endpoint { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; description: string; group: string }

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/jobs', description: 'List every job', group: 'Jobs' },
  { method: 'GET', path: '/api/jobs/stats', description: 'Aggregate counts per status / rate type', group: 'Jobs' },
  { method: 'GET', path: '/api/jobs/stats/by-year', description: 'Year-over-year job count + awarded/lost split', group: 'Jobs' },
  { method: 'GET', path: '/api/jobs/stats/awarded-revenue', description: 'Awarded revenue by year', group: 'Jobs' },
  { method: 'POST', path: '/api/jobs', description: 'Create a job', group: 'Jobs' },

  { method: 'GET', path: '/api/bid-results', description: 'List every bid result', group: 'Bid intel' },
  { method: 'GET', path: '/api/bid-results/stats', description: 'Lifetime + per-year win stats', group: 'Bid intel' },
  { method: 'GET', path: '/api/bid-results/stats/sparkline', description: 'Month-by-month wins/losses/won$', group: 'Bid intel' },
  { method: 'GET', path: '/api/bid-results/by-agency', description: 'Win rate per owner agency', group: 'Bid intel' },
  { method: 'POST', path: '/api/bid-results/import-csv', description: 'Bulk import bid results', group: 'Bid intel' },
  { method: 'GET', path: '/api/bid-results/export.csv', description: 'Download all bid results', group: 'Bid intel' },

  { method: 'GET', path: '/api/customers', description: 'List customers', group: 'Contacts' },
  { method: 'GET', path: '/api/customers/email-list', description: 'BCC-ready email list for newsletters', group: 'Contacts' },
  { method: 'GET', path: '/api/customers/export.csv', description: 'Customer master CSV export', group: 'Contacts' },
  { method: 'GET', path: '/api/vendors', description: 'List vendors', group: 'Contacts' },
  { method: 'GET', path: '/api/vendors/email-list', description: 'BCC-ready vendor email list', group: 'Contacts' },
  { method: 'GET', path: '/api/vendors/scorecard', description: 'Sub/supplier performance scorecard', group: 'Contacts' },
  { method: 'GET', path: '/api/vendors/export.csv', description: 'Vendor master CSV export', group: 'Contacts' },

  { method: 'GET', path: '/api/employees', description: 'List employees', group: 'People' },
  { method: 'GET', path: '/api/employees/utilization', description: 'Active vs total utilization', group: 'People' },
  { method: 'GET', path: '/api/employees/export.csv', description: 'Employee master CSV export', group: 'People' },

  { method: 'GET', path: '/api/materials', description: 'List materials', group: 'Master data' },
  { method: 'POST', path: '/api/materials/import-csv', description: 'Bulk import materials', group: 'Master data' },
  { method: 'GET', path: '/api/equipment-rates', description: 'List owned + rental rates', group: 'Master data' },
  { method: 'GET', path: '/api/equipment-rates/usage', description: 'Equipment usage on bid + actual sides', group: 'Master data' },
  { method: 'POST', path: '/api/equipment-rates/import-csv', description: 'Bulk import equipment rate book', group: 'Master data' },
  { method: 'GET', path: '/api/labor-rates', description: 'List labor rate records', group: 'Master data' },
  { method: 'GET', path: '/api/cost-codes', description: 'List cost codes', group: 'Master data' },

  { method: 'GET', path: '/api/admin/health', description: 'API health snapshot', group: 'Admin' },
  { method: 'GET', path: '/api/admin/data-status', description: 'Master record counts per entity', group: 'Admin' },
];

export default function ApiEndpointsPage() {
  requirePermission('audit:view');
  const groups: Record<string, Endpoint[]> = {};
  for (const e of ENDPOINTS) {
    if (!groups[e.group]) groups[e.group] = [];
    groups[e.group]!.push(e);
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="API endpoints" subtitle="Read-only inventory of the public API routes the web app uses." />
        <div className="space-y-6">
          {Object.entries(groups).map(([g, list]) => (
            <section key={g}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
                {list.map((e, i) => (
                  <li key={i} className="flex flex-col gap-1 px-4 py-2 text-sm md:flex-row md:items-baseline md:gap-3">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${e.method === 'GET' ? 'bg-blue-100 text-blue-800' : e.method === 'POST' ? 'bg-emerald-100 text-emerald-800' : e.method === 'PATCH' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                      {e.method}
                    </span>
                    <span className="font-mono text-xs text-gray-900">{e.path}</span>
                    <span className="text-xs text-gray-600 md:ml-auto">{e.description}</span>
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
