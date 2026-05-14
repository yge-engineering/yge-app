import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStatusStats } from './stats-panel';

export default function ByStatusStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by status — stats" subtitle="Count + share table for each status (read-only mirror of /jobs/by-status)." />
        <ByStatusStats />
      </main>
    </AppShell>
  );
}
