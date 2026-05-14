import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeDetail } from './detail-panel';

export default function JobsByRateTypeDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by rate type (detail)" subtitle="Expand each PW / Private bucket to see the jobs." />
        <ByRateTypeDetail />
      </main>
    </AppShell>
  );
}
