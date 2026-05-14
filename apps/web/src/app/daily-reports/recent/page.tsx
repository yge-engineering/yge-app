import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentDailyReportsTable } from './recent-table';

export default function RecentDailyReportsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent daily reports" subtitle="The 25 most recently saved daily reports." />
        <RecentDailyReportsTable />
      </main>
    </AppShell>
  );
}
