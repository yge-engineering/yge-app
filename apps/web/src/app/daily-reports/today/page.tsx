import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function DailyReportsTodayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Daily reports — today" subtitle="Reports whose reportDate is today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
