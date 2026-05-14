import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCityDetail } from './detail-panel';

export default function VendorsByCityDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors by city (detail)" subtitle="Expand each city to see the vendor list." />
        <ByCityDetail />
      </main>
    </AppShell>
  );
}
