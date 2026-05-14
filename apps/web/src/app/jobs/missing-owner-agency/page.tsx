import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingOwnerAgencyTable } from './missing-owner-agency-table';

export default function MissingOwnerAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs missing owner agency" subtitle="Records where the owner agency field is blank — data cleanup target." />
        <MissingOwnerAgencyTable />
      </main>
    </AppShell>
  );
}
