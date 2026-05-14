import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeTable } from './by-rate-type-table';

export default function JobsByRateTypePage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by rate type" subtitle="Split between prevailing-wage and private-rate projects." />
        <ByRateTypeTable />
      </main>
    </AppShell>
  );
}
