import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { JobsByMonthTable } from './by-month-table';

export default function JobsByMonthPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by month" subtitle="New jobs created each month, with awarded vs lost breakdown." />
        <JobsByMonthTable />
      </main>
    </AppShell>
  );
}
