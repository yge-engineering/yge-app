import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCategoryDetail } from './detail-panel';

export default function ByCategoryDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Materials by category (detail)" subtitle="Expand each category to see the material list." />
        <ByCategoryDetail />
      </main>
    </AppShell>
  );
}
