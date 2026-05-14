import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByLocationStats } from './stats-panel';

export default function ByLocationStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by location — stats" subtitle="Count + share of jobs per location string." />
        <ByLocationStats />
      </main>
    </AppShell>
  );
}
