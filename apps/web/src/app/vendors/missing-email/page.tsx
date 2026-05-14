import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingEmailTable } from './missing-email-table';

export default function VendorsMissingEmailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors missing email" subtitle="Records where the primary email is blank — data cleanup target." />
        <MissingEmailTable />
      </main>
    </AppShell>
  );
}
