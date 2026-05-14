import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AllByMonthTable } from './all-by-month-table';

export default function AllByMonthBidsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by yyyy-mm" subtitle="Every month with at least one recorded bid result, newest first." />
        <AllByMonthTable />
      </main>
    </AppShell>
  );
}
