import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { Last30DaysTable } from './last-30-table';

export default function Last30DaysPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bid results — last 30 days" subtitle="Bid tabs opened in the past 30 calendar days." />
        <Last30DaysTable />
      </main>
    </AppShell>
  );
}
