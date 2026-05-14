import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingJobNumberTable } from './missing-table';

export default function MissingJobNumberPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs missing job number" subtitle="Job records where the YGE job number field is blank." />
        <MissingJobNumberTable />
      </main>
    </AppShell>
  );
}
