import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisWeekTable } from './this-week-table';

export default function BidsThisWeekPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bid tabs — this week" subtitle="Bid results opened in the past 7 days." />
        <ThisWeekTable />
      </main>
    </AppShell>
  );
}
