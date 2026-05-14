import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByLocationTable } from './by-location-table';

export default function JobsByLocationPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by location" subtitle="Where our work happens, ranked by job count." />
        <ByLocationTable />
      </main>
    </AppShell>
  );
}
