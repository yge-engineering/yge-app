import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByLocationDetail } from './detail-panel';

export default function JobsByLocationDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by location (detail)" subtitle="Expand each location to see the jobs." />
        <ByLocationDetail />
      </main>
    </AppShell>
  );
}
