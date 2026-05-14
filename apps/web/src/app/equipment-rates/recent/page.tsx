import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentEquipmentRatesTable } from './recent-table';

export default function RecentEquipmentRatesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent equipment rates" subtitle="The 25 most recently added owned + rental equipment records." />
        <RecentEquipmentRatesTable />
      </main>
    </AppShell>
  );
}
