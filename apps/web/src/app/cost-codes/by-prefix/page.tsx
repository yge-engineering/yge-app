import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByPrefixTable } from './by-prefix-table';

export default function CostCodesByPrefixPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cost codes by prefix" subtitle="Cost-code records grouped by the LAB- / EQP- / MAT- prefix." />
        <ByPrefixTable />
      </main>
    </AppShell>
  );
}
