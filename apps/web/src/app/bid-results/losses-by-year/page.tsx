import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LossesByYear } from './stats-panel';

export default function LossesByYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Losses by year" subtitle="Count of WON_BY_OTHER bid results grouped by year." />
        <LossesByYear />
      </main>
    </AppShell>
  );
}
