import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingBillingAddressTable } from './missing-table';

export default function VendorsMissingBillingAddressPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors missing billing address" subtitle="Records without a billing address — payments cannot be mailed." />
        <MissingBillingAddressTable />
      </main>
    </AppShell>
  );
}
