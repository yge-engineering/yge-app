import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearDetail } from './detail-panel';

export default function JobsByYearDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by year (detail)" subtitle="Expand each year to see the jobs created in it." />
        <ByYearDetail />
      </main>
    </AppShell>
  );
}
