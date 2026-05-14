import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorScorecardTable } from './vendor-scorecard-table';

export default function VendorScorecardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Subcontractor scorecard"
          subtitle="Per-sub paid total, open balance, average days-to-pay, jobs delivered."
        />
        <VendorScorecardTable />
      </main>
    </AppShell>
  );
}
