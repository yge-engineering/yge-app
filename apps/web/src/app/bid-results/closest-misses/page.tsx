import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ClosestMissesTable } from './closest-misses-table';

export default function ClosestMissesPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Closest misses" subtitle="Lost bids ranked by smallest dollar gap to the winner." />
        <ClosestMissesTable />
      </main>
    </AppShell>
  );
}
