import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingStatusTable } from './missing-table';

export default function MissingStatusPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs missing status" subtitle="Records without a status — these are invisible to most pipeline views." />
        <MissingStatusTable />
      </main>
    </AppShell>
  );
}
