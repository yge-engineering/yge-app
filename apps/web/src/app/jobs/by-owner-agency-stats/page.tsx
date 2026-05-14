import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByAgencyStats } from './stats-panel';

export default function ByAgencyStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by owner agency — stats" subtitle="Count + share of jobs per owner agency." />
        <ByAgencyStats />
      </main>
    </AppShell>
  );
}
