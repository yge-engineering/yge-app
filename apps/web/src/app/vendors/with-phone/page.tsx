import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithPhoneTable } from './with-phone-table';

export default function VendorsWithPhonePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors with phone" subtitle="Records that have a phone number on file." />
        <WithPhoneTable />
      </main>
    </AppShell>
  );
}
