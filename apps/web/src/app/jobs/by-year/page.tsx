import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { JobsByYearTable } from './by-year-table';

export default function JobsByYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by year" subtitle="Jobs created each year, plus awarded/lost split." />
        <JobsByYearTable />
      </main>
    </AppShell>
  );
}
