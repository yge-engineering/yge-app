import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthStats } from './stats-panel';

export default function ByMonthStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by month — stats" subtitle="Count + share of jobs created per month." />
        <ByMonthStats />
      </main>
    </AppShell>
  );
}
