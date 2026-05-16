import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row {
  href: string;
  label: string;
  description: string;
}

const rows: Row[] = [
  { href: '/at-a-glance', label: 'At a glance', description: 'Original command-center landing.' },
  { href: '/at-a-glance-totals', label: 'At-a-glance totals', description: 'Four entity totals in one row.' },
  { href: '/at-a-glance-missing', label: 'At-a-glance missing', description: 'Missing-field totals per entity.' },
  { href: '/at-a-glance-grade', label: 'Data quality grade', description: 'Single A-F letter grade.' },
  { href: '/customers/total-count-card', label: 'Total customers', description: 'Single-tile total customer count.' },
  { href: '/vendors/total-count-card', label: 'Total vendors', description: 'Single-tile total vendor count.' },
  { href: '/jobs/total-count-card', label: 'Total jobs', description: 'Single-tile total job count.' },
  { href: '/employees/total-count-card', label: 'Total employees', description: 'Single-tile total employee count.' },
  { href: '/customers/by-state-count-card', label: 'Customer states', description: 'Distinct-state count tile.' },
  { href: '/vendors/by-state-count-card', label: 'Vendor states', description: 'Distinct-state count tile.' },
  { href: '/vendors/by-kind-count-card', label: 'Vendor kinds', description: 'Distinct-kind count tile.' },
  { href: '/jobs/by-status-count-card', label: 'Job statuses', description: 'Distinct-status count tile.' },
  { href: '/employees/by-classification-count-card', label: 'Classifications', description: 'Distinct-classification count tile.' },
  { href: '/employees/by-rate-type-count-card', label: 'Rate types', description: 'Distinct-rate-type count tile.' },
  { href: '/admin/dq-counts-card', label: 'DQ counts', description: 'Single giant tile of total missing-field cells.' },
];

export default function DashboardRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Dashboard roster" subtitle="Every at-a-glance and single-tile dashboard page in YGE, in one list." />
        <p className="mb-4 text-xs text-gray-600">
          Pin any of these as a browser bookmark for a one-click status check.
        </p>
        <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Page</th>
                <th className="px-3 py-2">What it shows</th>
                <th className="px-3 py-2">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.href}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.description}</td>
                  <td className="px-3 py-2">
                    <Link href={r.href} className="text-xs text-yge-blue-700 hover:underline">
                      Go →
                    </Link>
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
