import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeTable } from './by-rate-type-table';

export default function EstimatesByRateTypePage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Imported estimates by rate type" subtitle="PW vs Private split of estimate workbooks." />
        <ByRateTypeTable />
      </main>
    </AppShell>
  );
}
