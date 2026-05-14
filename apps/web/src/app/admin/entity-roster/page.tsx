import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Entity { name: string; description: string; master: string; api: string; reports: string }

const ENTITIES: Entity[] = [
  { name: 'Customer', description: 'Agency owners, primes, private customers.', master: '/customers', api: '/api/customers', reports: '/customers/by-kind' },
  { name: 'Vendor', description: 'Subs, suppliers, service providers.', master: '/vendors', api: '/api/vendors', reports: '/vendors/scorecard' },
  { name: 'Employee', description: 'Office + field staff.', master: '/employees/active', api: '/api/employees', reports: '/employees/by-status' },
  { name: 'Material', description: 'Material catalog.', master: '/materials', api: '/api/materials', reports: '/materials/by-category' },
  { name: 'Equipment rate', description: 'Owned + rental.', master: '/equipment-rates', api: '/api/equipment-rates', reports: '/equipment-rates/owned-vs-rental' },
  { name: 'Labor rate', description: 'PW + Private per classification.', master: '/labor-rates', api: '/api/labor-rates', reports: '/labor-rates/by-classification' },
  { name: 'Cost code', description: 'Reusable line buckets.', master: '/cost-codes', api: '/api/cost-codes', reports: '/cost-codes/by-prefix' },
  { name: 'Job', description: 'Every project YGE pursues.', master: '/jobs', api: '/api/jobs', reports: '/jobs/by-status' },
  { name: 'Imported estimate', description: 'Estimate workbooks.', master: '/imported-estimates', api: '/api/imported-estimates', reports: '/imported-estimates/by-rate-type' },
  { name: 'Bid result', description: 'Recorded bid tabulations.', master: '/bid-results', api: '/api/bid-results', reports: '/bid-results/outcomes' },
  { name: 'Daily report', description: 'Field daily reports.', master: '/daily-reports', api: '/api/imported-daily-reports', reports: '/daily-reports/this-month' },
];

export default function EntityRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Entity roster" subtitle="Every modeled entity, its master list, its API endpoint, and a starter report." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Master</th>
                <th className="px-3 py-2">API</th>
                <th className="px-3 py-2">Reports</th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES.map((e) => (
                <tr key={e.name} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{e.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{e.description}</td>
                  <td className="px-3 py-2"><Link href={e.master} className="text-xs text-yge-blue-700 hover:underline">{e.master}</Link></td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{e.api}</td>
                  <td className="px-3 py-2"><Link href={e.reports} className="text-xs text-yge-blue-700 hover:underline">{e.reports}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
