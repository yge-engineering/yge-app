import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { entity: string; importHref?: string; exportHref?: string; note?: string }

const ROWS: Row[] = [
  { entity: 'Customers', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports' },
  { entity: 'Vendors', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports' },
  { entity: 'Employees', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports' },
  { entity: 'Materials', importHref: '/admin/csv-imports' },
  { entity: 'Equipment rates', importHref: '/admin/csv-imports', exportHref: '/admin/csv-exports' },
  { entity: 'Labor rates', importHref: '/admin/csv-imports' },
  { entity: 'Cost codes' },
  { entity: 'Jobs', exportHref: '/admin/csv-exports' },
  { entity: 'Imported estimates', exportHref: '/admin/csv-exports' },
  { entity: 'Bid results', importHref: '/bid-results/import', exportHref: '/admin/csv-exports' },
  { entity: 'Daily reports', importHref: '/daily-reports/import' },
  { entity: 'Excel masters (legacy)', importHref: '/admin/excel-import', note: 'One-shot legacy rate-sheet import.' },
];

export default function ImportExportRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Import / export roster" subtitle="Every entry point for getting data into and out of the app." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Import</th>
                <th className="px-3 py-2">Export</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.entity} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{r.entity}</td>
                  <td className="px-3 py-2">
                    {r.importHref ? <Link href={r.importHref} className="text-xs text-yge-blue-700 hover:underline">{r.importHref}</Link> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.exportHref ? <Link href={r.exportHref} className="text-xs text-yge-blue-700 hover:underline">{r.exportHref}</Link> : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
