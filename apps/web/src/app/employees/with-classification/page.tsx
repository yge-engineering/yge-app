import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithClassTable } from './with-class-table';

export default function WithClassificationPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees with classification" subtitle="Records that have a classification code set — eligible for payroll runs." />
        <WithClassTable />
      </main>
    </AppShell>
  );
}
