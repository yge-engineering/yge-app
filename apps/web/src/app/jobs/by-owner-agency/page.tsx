import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByOwnerAgencyTable } from './by-owner-agency-table';

export default function JobsByOwnerAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by owner agency" subtitle="Who awards us work, ranked by count." />
        <ByOwnerAgencyTable />
      </main>
    </AppShell>
  );
}
