import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStatusTable } from './by-status-table';

export default function EmployeesByStatusPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by status" subtitle="Active, on-leave, terminated and beyond — at a glance." />
        <ByStatusTable />
      </main>
    </AppShell>
  );
}
