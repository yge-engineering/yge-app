import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByClassificationTable } from './by-classification-table';

export default function EmployeesByClassificationPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by classification" subtitle="Operator, laborer, foreman, etc. — counts per classification." />
        <ByClassificationTable />
      </main>
    </AppShell>
  );
}
