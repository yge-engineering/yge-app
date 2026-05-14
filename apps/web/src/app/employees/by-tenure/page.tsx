import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByTenureTable } from './by-tenure-table';

export default function EmployeesByTenurePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Active employees by tenure" subtitle="Bucketed by years since hireDate." />
        <ByTenureTable />
      </main>
    </AppShell>
  );
}
