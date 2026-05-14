import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingLocationTable } from './missing-table';

export default function MissingLocationPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs missing location" subtitle="Jobs where the location field is blank — chase to add." />
        <MissingLocationTable />
      </main>
    </AppShell>
  );
}
