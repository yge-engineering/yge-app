import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StatusOwnerDetailPanel } from './status-owner-detail-panel';

export default function JobsByStatusAndOwnerAgencyDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by status + owner agency (detail)" subtitle="Each (status, ownerAgency) bucket expands to the actual jobs in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/jobs/by-status-and-owner-agency" className="text-yge-blue-700 hover:underline">/jobs/by-status-and-owner-agency</Link>.
        </p>
        <StatusOwnerDetailPanel />
      </main>
    </AppShell>
  );
}
