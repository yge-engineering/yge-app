import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthStats } from './stats-panel';

export default function ThisMonthStatsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results — this month stats" subtitle="Outcome breakdown for the current calendar month." />
        <ThisMonthStats />
      </main>
    </AppShell>
  );
}
