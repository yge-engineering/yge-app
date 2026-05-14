import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LostByYearTable } from './stats-panel';

export default function LostByYearPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Lost jobs by year" subtitle="Count of jobs in LOST status, grouped by year of creation." />
        <LostByYearTable />
      </main>
    </AppShell>
  );
}
