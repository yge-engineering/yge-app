import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByAgencyStats } from './stats-panel';

export default function ByAgencyStatsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by agency — stats" subtitle="Count + win rate per owner agency." />
        <ByAgencyStats />
      </main>
    </AppShell>
  );
}
