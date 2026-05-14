import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithOwnerAgencyTable } from './with-owner-agency-table';

export default function WithOwnerAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs with owner agency" subtitle="Records that already have ownerAgency set." />
        <WithOwnerAgencyTable />
      </main>
    </AppShell>
  );
}
