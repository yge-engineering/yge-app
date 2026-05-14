import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ActiveByAgencyTable } from './active-table';

export default function ActiveByAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Active jobs by agency" subtitle="Count of jobs in AWARDED or BID_SUBMITTED status, grouped by owner agency." />
        <ActiveByAgencyTable />
      </main>
    </AppShell>
  );
}
