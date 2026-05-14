import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ClosedByYearTable } from './closed-by-year-table';

export default function ClosedByYearPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Closed jobs by year" subtitle="Count of jobs that moved to CLOSED, grouped by the year of closure." />
        <ClosedByYearTable />
      </main>
    </AppShell>
  );
}
