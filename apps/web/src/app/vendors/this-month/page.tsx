import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthTable } from './this-month-table';

export default function VendorsThisMonthPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors added this month" subtitle="Vendors whose createdAt falls in the current calendar month." />
        <ThisMonthTable />
      </main>
    </AppShell>
  );
}
