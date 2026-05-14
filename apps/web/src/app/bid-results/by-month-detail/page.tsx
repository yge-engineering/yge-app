import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthDetail } from './detail-panel';

export default function ByMonthDetailPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by month (detail)" subtitle="Expand each month to see its bid history." />
        <ByMonthDetail />
      </main>
    </AppShell>
  );
}
