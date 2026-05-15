import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row {
  label: string;
  href: string;
  kind: 'CSV' | 'JSON' | 'XLSX' | 'PDF';
  description: string;
}

const rows: Row[] = [
  { label: 'Customers', href: '/api/customers.csv', kind: 'CSV', description: 'All customers with email, phone, billing.' },
  { label: 'Vendors', href: '/api/vendors.csv', kind: 'CSV', description: 'All vendors with kind, state, contact.' },
  { label: 'Jobs', href: '/api/jobs.csv', kind: 'CSV', description: 'All jobs with status, owner agency, contract amount.' },
  { label: 'Employees', href: '/api/employees.csv', kind: 'CSV', description: 'All employees with classification, hire date.' },
  { label: 'Estimates', href: '/api/estimates.csv', kind: 'CSV', description: 'Estimates with bid total + status.' },
  { label: 'Bid results', href: '/api/bid-results.csv', kind: 'CSV', description: 'Tracked bid openings + outcomes.' },
  { label: 'Imported estimates', href: '/api/imported-estimates.csv', kind: 'CSV', description: 'Excel-imported historical estimates.' },
  { label: 'Cost codes', href: '/api/cost-codes.csv', kind: 'CSV', description: 'Master cost-code list.' },
  { label: 'Equipment', href: '/api/equipment.csv', kind: 'CSV', description: 'Owned equipment with rates.' },
  { label: 'Materials', href: '/api/materials.csv', kind: 'CSV', description: 'Material master list.' },
];

export default function ExportsRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Exports roster" subtitle="Direct download links for every CSV/JSON export endpoint." />
        <p className="mb-4 text-xs text-gray-600">
          All endpoints require sign-in. Cross-reference with <Link href="/admin/api-conventions" className="text-yge-blue-700 hover:underline">/admin/api-conventions</Link>{' '}
          and <Link href="/admin/data-shapes" className="text-yge-blue-700 hover:underline">/admin/data-shapes</Link>.
        </p>
        <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Export</th>
                <th className="px-3 py-2">Format</th>
                <th className="px-3 py-2">What you get</th>
                <th className="px-3 py-2">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.href}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.kind}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.description}</td>
                  <td className="px-3 py-2">
                    <a href={r.href} className="text-xs text-yge-blue-700 hover:underline">
                      Download →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
