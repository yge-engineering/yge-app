import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeStats } from './stats-panel';

export default function ByRateTypeStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by rate type — stats" subtitle="Count + share of jobs split between PW and Private." />
        <ByRateTypeStats />
      </main>
    </AppShell>
  );
}
