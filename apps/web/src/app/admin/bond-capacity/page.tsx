import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function BondCapacityPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bond capacity" subtitle="Single-job + aggregate bond limits (placeholder)." />
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-700">
            Bond capacity tracking lives in the master-profile (Phase 1
            scope). When connected, this page will show:
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-gray-700 space-y-1">
            <li>Current single-job bond limit (from bonding agent)</li>
            <li>Current aggregate (total open work) limit</li>
            <li>Capacity used (sum of bid$ on AWARDED/ACTIVE/BID_SUBMITTED jobs)</li>
            <li>Capacity available — what we can still bid</li>
            <li>HHI from /customers/concentration (bonding underwriters care)</li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Update via <code>/master-profile</code> once bond fields are wired.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
