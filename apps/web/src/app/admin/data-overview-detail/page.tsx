import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Entity {
  name: string;
  description: string;
  browseHref: string;
  newHref?: string;
  importHref?: string;
  exportHref?: string;
  reportsHref?: string;
}

const ENTITIES: Entity[] = [
  { name: 'Jobs', description: 'Every project YGE pursues, bids, wins, or works.', browseHref: '/jobs', newHref: '/jobs/new', reportsHref: '/jobs/by-status' },
  { name: 'Bid results', description: 'Every recorded agency bid tabulation.', browseHref: '/bid-results', newHref: '/bid-results/new', importHref: '/bid-results/import', exportHref: '/admin/csv-exports', reportsHref: '/bid-results/outcomes' },
  { name: 'Customers', description: 'Master list of agencies, primes, and private customers.', browseHref: '/customers', newHref: '/customers/new', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports', reportsHref: '/customers/by-kind' },
  { name: 'Vendors', description: 'Subs, suppliers, service providers.', browseHref: '/vendors', newHref: '/vendors/new', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports', reportsHref: '/vendors/scorecard' },
  { name: 'Employees', description: 'Staff roster — office, foremen, crew.', browseHref: '/employees', newHref: '/employees/new', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports', reportsHref: '/employees/by-status' },
  { name: 'Materials', description: 'Material catalog with categories + UoMs.', browseHref: '/materials', newHref: '/materials/new', importHref: '/admin/csv-imports', reportsHref: '/materials/by-category' },
  { name: 'Equipment rates', description: 'Owned + rental equipment rate book.', browseHref: '/equipment-rates', newHref: '/equipment-rates/new', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports', reportsHref: '/equipment-rates/owned-vs-rental' },
  { name: 'Labor rates', description: 'Per-classification PW + Private rates.', browseHref: '/labor-rates', newHref: '/labor-rates/new', importHref: '/admin/csv-imports', reportsHref: '/labor-rates/by-classification' },
  { name: 'Cost codes', description: 'Reusable buckets that estimate lines roll into.', browseHref: '/cost-codes', newHref: '/cost-codes/new', reportsHref: '/cost-codes/by-prefix' },
  { name: 'Imported estimates', description: 'Estimate workbooks brought in from Excel or built in-app.', browseHref: '/imported-estimates', newHref: '/imported-estimates/new', reportsHref: '/imported-estimates/by-rate-type' },
  { name: 'Daily reports', description: 'Field daily reports (hours, equipment, weather).', browseHref: '/daily-reports', importHref: '/daily-reports/import', reportsHref: '/daily-reports/this-month' },
];

export default function DataOverviewDetailPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Data overview — detail" subtitle="Every master entity, what it is, and every action available." />
        <div className="space-y-3">
          {ENTITIES.map((e) => (
            <details key={e.name} className="rounded border border-gray-200 bg-white shadow-sm">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                <span className="font-semibold text-gray-900">{e.name}</span>
                <span className="ml-2 text-xs text-gray-600">{e.description}</span>
              </summary>
              <ul className="grid grid-cols-2 gap-2 px-3 pb-3 text-sm md:grid-cols-5">
                <li><Link href={e.browseHref} className="text-yge-blue-700 hover:underline">Browse</Link></li>
                {e.newHref ? <li><Link href={e.newHref} className="text-yge-blue-700 hover:underline">New</Link></li> : null}
                {e.importHref ? <li><Link href={e.importHref} className="text-yge-blue-700 hover:underline">Import CSV</Link></li> : null}
                {e.exportHref ? <li><Link href={e.exportHref} className="text-yge-blue-700 hover:underline">Export CSV</Link></li> : null}
                {e.reportsHref ? <li><Link href={e.reportsHref} className="text-yge-blue-700 hover:underline">Reports</Link></li> : null}
              </ul>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
