import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearStats } from './stats-panel';

export default function ThisYearStatsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results — this year stats" subtitle="Outcome breakdown + won $ for the current calendar year." />
        <ThisYearStats />
      </main>
    </AppShell>
  );
}
