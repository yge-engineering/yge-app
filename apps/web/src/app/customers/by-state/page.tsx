import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CustomersByStateTable } from './by-state-table';

export default function CustomersByStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by state" subtitle="Geographic spread of customers on the master list." />
        <CustomersByStateTable />
      </main>
    </AppShell>
  );
}
