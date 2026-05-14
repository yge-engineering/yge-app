import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithStateTable } from './with-state-table';

export default function CustomersWithStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers with state" subtitle="Records that already have a state code set." />
        <WithStateTable />
      </main>
    </AppShell>
  );
}
