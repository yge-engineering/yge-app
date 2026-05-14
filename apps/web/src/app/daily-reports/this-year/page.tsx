import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function DailyReportsThisYearPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Daily reports — this year" subtitle="Reports whose reportDate is in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
