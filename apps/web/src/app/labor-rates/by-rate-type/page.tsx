import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeTable } from './by-rate-type-table';

export default function LaborRatesByRateTypePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Labor rates by rate type" subtitle="PW vs Private split — counts and average hourly rate." />
        <ByRateTypeTable />
      </main>
    </AppShell>
  );
}
