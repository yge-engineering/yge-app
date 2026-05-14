import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AwardedByYearTable } from './stats-panel';

export default function AwardedByYearPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Awarded jobs by year" subtitle="Count of jobs awarded each year (status AWARDED / ACTIVE / CLOSED)." />
        <AwardedByYearTable />
      </main>
    </AppShell>
  );
}
