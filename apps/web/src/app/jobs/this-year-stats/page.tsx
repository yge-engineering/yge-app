import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearStats } from './stats-panel';

export default function ThisYearStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs — this year stats" subtitle="Status breakdown for jobs created this calendar year." />
        <ThisYearStats />
      </main>
    </AppShell>
  );
}
