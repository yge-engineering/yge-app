import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByDayOfWeekTable } from './by-dow-table';

export default function ByDayOfWeekPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by day of week" subtitle="Which weekdays do agency openings fall on most often?" />
        <ByDayOfWeekTable />
      </main>
    </AppShell>
  );
}
