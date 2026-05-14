import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearDetail } from './detail-panel';

export default function ByYearDetailPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by year (detail)" subtitle="Expand each year to see its bid history." />
        <ByYearDetail />
      </main>
    </AppShell>
  );
}
