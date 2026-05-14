import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithBillingAddressTable } from './with-billing-table';

export default function VendorsWithBillingAddressPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors with billing address" subtitle="Records that have a billing address line on file." />
        <WithBillingAddressTable />
      </main>
    </AppShell>
  );
}
