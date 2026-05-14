import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthTable } from './this-month-table';

export default function EmployeesThisMonthPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Hires this month" subtitle="Employees hired in the current calendar month." />
        <ThisMonthTable />
      </main>
    </AppShell>
  );
}
