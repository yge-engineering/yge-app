import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { NoAwardTable } from './no-award-table';

export default function NoAwardPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bids — no award" subtitle="Bid tabs that closed with NO_AWARD (no contractor chosen)." />
        <NoAwardTable />
      </main>
    </AppShell>
  );
}
