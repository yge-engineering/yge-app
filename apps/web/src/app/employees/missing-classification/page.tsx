import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingClassificationTable } from './missing-class-table';

export default function MissingClassificationPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees missing classification" subtitle="Active employees without a classification code — fix before payroll runs." />
        <MissingClassificationTable />
      </main>
    </AppShell>
  );
}
