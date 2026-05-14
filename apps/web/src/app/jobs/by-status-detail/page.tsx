import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStatusDetail } from './detail-panel';

export default function ByStatusDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by status (detail)" subtitle="Expand each status to see the job list." />
        <ByStatusDetail />
      </main>
    </AppShell>
  );
}
