import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingRateTypeTable } from './missing-table';

export default function MissingRateTypePage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs missing rate type" subtitle="Records where rateType is blank — costing assumptions cannot run." />
        <MissingRateTypeTable />
      </main>
    </AppShell>
  );
}
