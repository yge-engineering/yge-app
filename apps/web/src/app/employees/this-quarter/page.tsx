import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterTable } from './this-quarter-table';

export default function EmployeesThisQuarterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Hires this quarter" subtitle="Employees hired in the current calendar quarter." />
        <ThisQuarterTable />
      </main>
    </AppShell>
  );
}
