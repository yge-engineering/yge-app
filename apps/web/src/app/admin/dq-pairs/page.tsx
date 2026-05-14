import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Pair { label: string; missing: string; withIt: string; detail?: string }

const PAIRS: Pair[] = [
  { label: 'Customers — email', missing: '/customers/missing-email', withIt: '/customers/with-email' },
  { label: 'Customers — phone', missing: '/customers/missing-phone', withIt: '/customers/with-phone' },
  { label: 'Customers — state', missing: '/customers/missing-state', withIt: '/customers/with-state', detail: '/customers/by-state-detail' },
  { label: 'Customers — billing addr', missing: '/customers/missing-billing-address', withIt: '/customers/with-billing-address' },
  { label: 'Vendors — email', missing: '/vendors/missing-email', withIt: '/vendors/with-email' },
  { label: 'Vendors — phone', missing: '/vendors/missing-phone', withIt: '/vendors/with-phone' },
  { label: 'Vendors — state', missing: '/vendors/missing-state', withIt: '/vendors/with-state', detail: '/vendors/by-state-detail' },
  { label: 'Vendors — billing addr', missing: '/vendors/missing-billing-address', withIt: '/vendors/with-billing-address' },
  { label: 'Jobs — owner agency', missing: '/jobs/missing-owner-agency', withIt: '/jobs/with-owner-agency', detail: '/jobs/by-owner-agency-detail' },
  { label: 'Jobs — job number', missing: '/jobs/missing-job-number', withIt: '/jobs/with-job-number' },
  { label: 'Jobs — location', missing: '/jobs/missing-location', withIt: '/jobs/with-location', detail: '/jobs/by-location-detail' },
  { label: 'Jobs — status', missing: '/jobs/missing-status', withIt: '/jobs/with-status', detail: '/jobs/by-status-detail' },
  { label: 'Jobs — rate type', missing: '/jobs/missing-rate-type', withIt: '/jobs/with-rate-type', detail: '/jobs/by-rate-type-detail' },
  { label: 'Employees — classification', missing: '/employees/missing-classification', withIt: '/employees/with-classification', detail: '/employees/by-classification-detail' },
  { label: 'Employees — hire date', missing: '/employees/missing-hire-date', withIt: '/employees/with-hire-date' },
];

export default function DqPairsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Data-quality pairs" subtitle={`${PAIRS.length} fields. Each row: missing-X (red), has-it (green), optional detail.`} />
        <div className="grid gap-3 md:grid-cols-2">
          {PAIRS.map((p) => (
            <article key={p.label} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">{p.label}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Link href={p.missing} className="rounded bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100">missing</Link>
                <Link href={p.withIt} className="rounded bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100">has it</Link>
                {p.detail ? <Link href={p.detail} className="rounded bg-gray-50 px-2 py-1 text-yge-blue-700 hover:bg-gray-100">detail</Link> : null}
              </div>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
