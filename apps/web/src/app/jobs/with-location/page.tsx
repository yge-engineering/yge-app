import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithLocationTable } from './with-location-table';

export default function WithLocationPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs with location" subtitle="Records that already have the location field filled in." />
        <WithLocationTable />
      </main>
    </AppShell>
  );
}
