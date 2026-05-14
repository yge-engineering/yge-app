import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithRateTypeTable } from './with-rate-type-table';

export default function WithRateTypePage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs with rate type" subtitle="Records that already have rateType set (costing assumptions can run)." />
        <WithRateTypeTable />
      </main>
    </AppShell>
  );
}
