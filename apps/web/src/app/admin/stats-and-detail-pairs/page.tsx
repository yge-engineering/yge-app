import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Pair { label: string; stats: string; detail: string }

const PAIRS: Pair[] = [
  { label: 'Jobs — by status', stats: '/jobs/by-status-stats', detail: '/jobs/by-status-detail' },
  { label: 'Jobs — by owner agency', stats: '/jobs/by-owner-agency-stats', detail: '/jobs/by-owner-agency-detail' },
  { label: 'Bid results — by agency', stats: '/bid-results/by-agency-stats', detail: '/bid-results/by-agency-detail' },
  { label: 'Bid results — by outcome', stats: '/bid-results/by-outcome-stats', detail: '/bid-results/outcomes' },
  { label: 'Customers — by kind', stats: '/customers/by-kind-stats', detail: '/customers/by-kind-detail' },
  { label: 'Vendors — by kind', stats: '/vendors/by-kind-stats', detail: '/vendors/by-kind-detail' },
  { label: 'Employees — by classification', stats: '/employees/by-classification-stats', detail: '/employees/by-classification-detail' },
  { label: 'Materials — by category', stats: '/materials/by-category-stats', detail: '/materials/by-category-detail' },
  { label: 'Cost codes — by prefix', stats: '/cost-codes/by-prefix-stats', detail: '/cost-codes/by-prefix-detail' },
];

export default function StatsAndDetailPairsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Stats + detail pairs" subtitle="For each grouping, the count-table and the expandable record-list together." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Grouping</th>
                <th className="px-3 py-2">Stats</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((p) => (
                <tr key={p.label} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{p.label}</td>
                  <td className="px-3 py-2"><Link href={p.stats} className="text-yge-blue-700 hover:underline">stats</Link></td>
                  <td className="px-3 py-2"><Link href={p.detail} className="text-yge-blue-700 hover:underline">detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
