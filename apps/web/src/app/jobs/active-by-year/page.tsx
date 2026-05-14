import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ActiveByYearTable } from './active-by-year-table';

export default function ActiveByYearPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Active / awarded jobs by year" subtitle="Year-by-year count of jobs currently in AWARDED or BID_SUBMITTED status." />
        <ActiveByYearTable />
      </main>
    </AppShell>
  );
}
