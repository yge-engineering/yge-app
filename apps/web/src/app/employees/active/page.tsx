import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ActiveEmployeesTable } from './active-table';

export default function ActiveEmployeesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Active employees" subtitle="Everyone with status = ACTIVE on the roster." />
        <ActiveEmployeesTable />
      </main>
    </AppShell>
  );
}
