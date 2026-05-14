import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ApparentLowsTable } from './apparent-lows-table';

export default function ApparentLowsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Apparent low bids" subtitle="Bids where YGE was the apparent low bidder (rank #1)." />
        <ApparentLowsTable />
      </main>
    </AppShell>
  );
}
