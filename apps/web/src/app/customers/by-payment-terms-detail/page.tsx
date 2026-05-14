import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByPaymentTermsDetail } from './detail-panel';

export default function ByPaymentTermsDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by payment terms (detail)" subtitle="Expand each terms bucket to see the customer list." />
        <ByPaymentTermsDetail />
      </main>
    </AppShell>
  );
}
