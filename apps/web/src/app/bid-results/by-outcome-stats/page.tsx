import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByOutcomeStats } from './stats-panel';

export default function ByOutcomeStatsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by outcome — stats" subtitle="Count + share per outcome with one-click drill-down." />
        <ByOutcomeStats />
      </main>
    </AppShell>
  );
}
