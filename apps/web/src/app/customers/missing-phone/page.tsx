import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingPhoneTable } from './missing-phone-table';

export default function MissingPhonePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers missing phone" subtitle="Records without a phone number — useful for chase calls." />
        <MissingPhoneTable />
      </main>
    </AppShell>
  );
}
