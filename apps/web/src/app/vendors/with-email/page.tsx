import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithEmailTable } from './with-email-table';

export default function VendorsWithEmailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors with email on file" subtitle="Records that already have a valid email — eligible for newsletter / e-bid." />
        <WithEmailTable />
      </main>
    </AppShell>
  );
}
