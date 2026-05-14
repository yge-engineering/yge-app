// /bid-results/by-agency — Win rate by agency / client.

import { ByAgencyTable } from './by-agency-table';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function BidResultsByAgencyPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Bid win rate by agency"
          subtitle="How often we win bids per client / owner agency."
        />
        <ByAgencyTable />
      </main>
    </AppShell>
  );
}
