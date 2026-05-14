import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByAgencyDetail } from './detail-panel';

export default function JobsByAgencyDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by owner agency (detail)" subtitle="Expand each agency to see its jobs." />
        <ByAgencyDetail />
      </main>
    </AppShell>
  );
}
