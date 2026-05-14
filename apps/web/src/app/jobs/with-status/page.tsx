import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithStatusTable } from './with-status-table';

export default function WithStatusPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs with status" subtitle="Records that already have a status set." />
        <WithStatusTable />
      </main>
    </AppShell>
  );
}
