import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCityDetail } from './detail-panel';

export default function CustomersByCityDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by city (detail)" subtitle="Expand each city to see the customer list." />
        <ByCityDetail />
      </main>
    </AppShell>
  );
}
