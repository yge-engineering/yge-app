import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function EmployeesTodayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Hires today" subtitle="Employees whose hireDate is today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
