import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OwnedVsRentalTable } from './split-table';

export default function OwnedVsRentalPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Equipment: owned vs rental" subtitle="Record counts + hourly rate spread for each kind of equipment." />
        <OwnedVsRentalTable />
      </main>
    </AppShell>
  );
}
