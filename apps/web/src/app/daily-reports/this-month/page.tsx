import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthTable } from './this-month-table';

export default function DailyReportsThisMonthPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Daily reports — this month" subtitle="Reports whose reportDate is in the current calendar month." />
        <ThisMonthTable />
      </main>
    </AppShell>
  );
}
