import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function EmployeesThisYearPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Hires this year" subtitle="Employees whose hireDate falls in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
