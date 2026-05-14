import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStateDetail } from './detail-panel';

export default function ByStateDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by state (detail)" subtitle="Expand each state to see the customer list." />
        <ByStateDetail />
      </main>
    </AppShell>
  );
}
