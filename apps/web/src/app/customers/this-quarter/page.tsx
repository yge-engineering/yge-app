import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterTable } from './this-quarter-table';

export default function CustomersThisQuarterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers added this quarter" subtitle="Customer records with createdAt in the current calendar quarter." />
        <ThisQuarterTable />
      </main>
    </AppShell>
  );
}
