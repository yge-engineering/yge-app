import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithHireDateTable } from './with-hire-date-table';

export default function WithHireDatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees with hire date" subtitle="Records that have a hire date on file." />
        <WithHireDateTable />
      </main>
    </AppShell>
  );
}
