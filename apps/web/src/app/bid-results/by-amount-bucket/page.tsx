import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByAmountBucketTable } from './by-amount-bucket-table';

export default function ByAmountBucketPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by amount bucket" subtitle="How many YGE bids fall into each dollar-amount bucket." />
        <ByAmountBucketTable />
      </main>
    </AppShell>
  );
}
