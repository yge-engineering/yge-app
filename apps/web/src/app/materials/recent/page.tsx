import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentMaterialsTable } from './recent-table';

export default function RecentMaterialsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent materials" subtitle="The 25 most recently added material records." />
        <RecentMaterialsTable />
      </main>
    </AppShell>
  );
}
