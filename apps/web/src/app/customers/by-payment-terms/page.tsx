import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByPaymentTermsTable } from './by-payment-terms-table';

export default function ByPaymentTermsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by payment terms" subtitle="How many customers fall into each terms bucket (Net 30, Net 60, etc.)." />
        <ByPaymentTermsTable />
      </main>
    </AppShell>
  );
}
