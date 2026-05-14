import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LaborUtilizationTable } from './labor-utilization-table';

export default function LaborUtilizationPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Labor utilization"
          subtitle="Hours logged per employee per week, from daily report LAB-* lines."
        />
        <LaborUtilizationTable />
      </main>
    </AppShell>
  );
}
