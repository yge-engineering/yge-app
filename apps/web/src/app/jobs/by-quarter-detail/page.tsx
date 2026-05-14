import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByQuarterDetail } from './detail-panel';

export default function JobsByQuarterDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by quarter (detail)" subtitle="Expand each quarter to see the jobs created in it." />
        <ByQuarterDetail />
      </main>
    </AppShell>
  );
}
