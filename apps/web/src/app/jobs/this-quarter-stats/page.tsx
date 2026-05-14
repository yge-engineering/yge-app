import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterStats } from './stats-panel';

export default function ThisQuarterStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs — this quarter stats" subtitle="Status breakdown for jobs created this quarter." />
        <ThisQuarterStats />
      </main>
    </AppShell>
  );
}
