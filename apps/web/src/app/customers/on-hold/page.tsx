import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OnHoldTable } from './on-hold-table';

export default function CustomersOnHoldPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers on hold" subtitle="Active accounts flagged as on-hold; don't ship goods until cleared." />
        <OnHoldTable />
      </main>
    </AppShell>
  );
}
