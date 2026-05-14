import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function CustomersThisYearPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers added this year" subtitle="Customers whose createdAt falls in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
