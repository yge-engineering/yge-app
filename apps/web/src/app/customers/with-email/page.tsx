import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithEmailTable } from './with-email-table';

export default function CustomersWithEmailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers with email" subtitle="Records that already have a valid email — eligible for newsletter / e-invoice." />
        <WithEmailTable />
      </main>
    </AppShell>
  );
}
