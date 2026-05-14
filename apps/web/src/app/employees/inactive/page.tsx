import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { InactiveTable } from './inactive-table';

export default function InactiveEmployeesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Inactive employees" subtitle="Anyone not in ACTIVE status (terminated, on leave, retired, etc.)." />
        <InactiveTable />
      </main>
    </AppShell>
  );
}
