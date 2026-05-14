import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WinsByYear } from './stats-panel';

export default function WinsByYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Wins by year" subtitle="Count of WON_BY_YGE bid results grouped by year." />
        <WinsByYear />
      </main>
    </AppShell>
  );
}
