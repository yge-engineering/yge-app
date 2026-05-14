import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStatusTable } from './by-status-table';

export default function JobsByStatusPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by status" subtitle="Live count of every job by current pipeline status." />
        <ByStatusTable />
      </main>
    </AppShell>
  );
}
