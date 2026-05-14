import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithJobNumberTable } from './with-job-number-table';

export default function WithJobNumberPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs with job number" subtitle="Records that already have the YGE job number assigned." />
        <WithJobNumberTable />
      </main>
    </AppShell>
  );
}
