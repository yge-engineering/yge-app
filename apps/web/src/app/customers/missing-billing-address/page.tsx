import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingBillingAddressTable } from './missing-table';

export default function MissingBillingAddressPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers missing billing address" subtitle="Records without a billing address line — invoices will go nowhere." />
        <MissingBillingAddressTable />
      </main>
    </AppShell>
  );
}
