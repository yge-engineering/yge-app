import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AllByMonthTable } from './all-by-month-table';

export default function AllByMonthPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by created yyyy-mm" subtitle="Every month with at least one job, full history (not just current year)." />
        <AllByMonthTable />
      </main>
    </AppShell>
  );
}
