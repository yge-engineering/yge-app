import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingPhoneTable } from './missing-phone-table';

export default function VendorsMissingPhonePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors missing phone" subtitle="Vendor records without a phone number — chase to fill." />
        <MissingPhoneTable />
      </main>
    </AppShell>
  );
}
