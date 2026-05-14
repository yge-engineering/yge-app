import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function VendorsThisYearPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors added this year" subtitle="Vendors whose createdAt falls in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
