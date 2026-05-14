import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentEmployeesTable } from './recent-table';

export default function RecentEmployeesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent hires" subtitle="The 25 most recently hired employees, newest first." />
        <RecentEmployeesTable />
      </main>
    </AppShell>
  );
}
