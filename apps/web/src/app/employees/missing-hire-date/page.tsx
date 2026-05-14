import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingHireDateTable } from './missing-table';

export default function MissingHireDatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees missing hire date" subtitle="Records without a hireDate — needed for tenure + classification reporting." />
        <MissingHireDateTable />
      </main>
    </AppShell>
  );
}
