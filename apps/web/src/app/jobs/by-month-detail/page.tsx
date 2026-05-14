import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthDetail } from './detail-panel';

export default function JobsByMonthDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by month (detail)" subtitle="Expand each month to see the jobs created in it." />
        <ByMonthDetail />
      </main>
    </AppShell>
  );
}
