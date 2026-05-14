import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisWeekTable } from './this-week-table';

export default function EmployeesThisWeekPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Hires this week" subtitle="Employees hired in the past 7 days." />
        <ThisWeekTable />
      </main>
    </AppShell>
  );
}
