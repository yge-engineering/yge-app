import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WinsByMonth } from './stats-panel';

export default function WinsByMonthPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Wins by month" subtitle="WON_BY_YGE bid results grouped by month, newest first." />
        <WinsByMonth />
      </main>
    </AppShell>
  );
}
