import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Pair { label: string; missing: string; withIt: string }

const PAIRS: Pair[] = [
  { label: 'Customers — email', missing: '/customers/missing-email', withIt: '/customers/with-email' },
  { label: 'Customers — phone', missing: '/customers/missing-phone', withIt: '/customers/with-phone' },
  { label: 'Customers — state', missing: '/customers/missing-state', withIt: '/customers/with-state' },
  { label: 'Customers — billing address', missing: '/customers/missing-billing-address', withIt: '/customers/with-billing-address' },
  { label: 'Vendors — email', missing: '/vendors/missing-email', withIt: '/vendors/with-email' },
  { label: 'Vendors — phone', missing: '/vendors/missing-phone', withIt: '/vendors/with-phone' },
  { label: 'Vendors — state', missing: '/vendors/missing-state', withIt: '/vendors/with-state' },
  { label: 'Vendors — billing address', missing: '/vendors/missing-billing-address', withIt: '/vendors/with-billing-address' },
  { label: 'Jobs — owner agency', missing: '/jobs/missing-owner-agency', withIt: '/jobs/with-owner-agency' },
  { label: 'Jobs — job number', missing: '/jobs/missing-job-number', withIt: '/jobs/with-job-number' },
  { label: 'Jobs — location', missing: '/jobs/missing-location', withIt: '/jobs/with-location' },
  { label: 'Jobs — rate type', missing: '/jobs/missing-rate-type', withIt: '/jobs/with-rate-type' },
  { label: 'Jobs — status', missing: '/jobs/missing-status', withIt: '/jobs/with-status' },
  { label: 'Employees — classification', missing: '/employees/missing-classification', withIt: '/employees/with-classification' },
  { label: 'Employees — hire date', missing: '/employees/missing-hire-date', withIt: '/employees/with-hire-date' },
];

export default function InversesHubV2Page() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cleanup inverses" subtitle={`${PAIRS.length} field cleanup pairs. Jump to records missing it or records that have it.`} />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Missing</th>
                <th className="px-3 py-2">Has it</th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((p) => (
                <tr key={p.label} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{p.label}</td>
                  <td className="px-3 py-2"><Link href={p.missing} className="text-red-700 hover:underline">missing</Link></td>
                  <td className="px-3 py-2"><Link href={p.withIt} className="text-green-700 hover:underline">has it</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
