import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentLaborRatesTable } from './recent-table';

export default function RecentLaborRatesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent labor rates" subtitle="The 25 most recently added labor rate records." />
        <RecentLaborRatesTable />
      </main>
    </AppShell>
  );
}
