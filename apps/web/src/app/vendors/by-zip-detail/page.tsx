import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByZipDetail } from './detail-panel';

export default function VendorsByZipDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors by zip (detail)" subtitle="Expand each zip to see the vendor list." />
        <ByZipDetail />
      </main>
    </AppShell>
  );
}
