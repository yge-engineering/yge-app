import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthStats } from './stats-panel';

export default function ByMonthStatsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by month — stats" subtitle="Count + share of bid results per month." />
        <ByMonthStats />
      </main>
    </AppShell>
  );
}
