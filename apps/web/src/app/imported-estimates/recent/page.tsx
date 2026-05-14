import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentImportedEstimatesTable } from './recent-table';

export default function RecentImportedEstimatesPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent imported estimates" subtitle="The 25 most recently imported / saved estimate workbooks." />
        <RecentImportedEstimatesTable />
      </main>
    </AppShell>
  );
}
