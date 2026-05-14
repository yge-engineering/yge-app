import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WinRateByYear } from './stats-panel';

export default function WinRateByYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Win rate by year" subtitle="Won decided / (won + lost) percentage per calendar year." />
        <WinRateByYear />
      </main>
    </AppShell>
  );
}
