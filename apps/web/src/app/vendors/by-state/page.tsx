import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorsByStateTable } from './by-state-table';

export default function VendorsByStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by state" subtitle="Geographic spread of vendors and subcontractors." />
        <VendorsByStateTable />
      </main>
    </AppShell>
  );
}
