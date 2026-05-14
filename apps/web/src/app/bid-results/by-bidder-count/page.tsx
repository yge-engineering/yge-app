import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByBidderCountTable } from './by-bidder-count-table';

export default function ByBidderCountPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by bidder count" subtitle="How many tabs have 1 bidder, 2 bidders, 3+, etc." />
        <ByBidderCountTable />
      </main>
    </AppShell>
  );
}
