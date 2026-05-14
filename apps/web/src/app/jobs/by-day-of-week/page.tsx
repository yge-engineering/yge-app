import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByDayOfWeekTable } from './by-dow-table';

export default function JobsByDayOfWeekPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs created by day of week" subtitle="Which weekdays do we tend to start jobs on?" />
        <ByDayOfWeekTable />
      </main>
    </AppShell>
  );
}
