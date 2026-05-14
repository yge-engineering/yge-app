import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByKindDetail } from './detail-panel';

export default function ByKindDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors by kind (detail)" subtitle="Expand each kind bucket to see the vendor list." />
        <ByKindDetail />
      </main>
    </AppShell>
  );
}
