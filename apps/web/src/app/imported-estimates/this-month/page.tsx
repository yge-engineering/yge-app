import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthTable } from './this-month-table';

export default function EstimatesThisMonthPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported estimates — this month" subtitle="Workbooks updated or saved in the current month." />
        <ThisMonthTable />
      </main>
    </AppShell>
  );
}
