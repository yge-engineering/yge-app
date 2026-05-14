import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentCostCodesTable } from './recent-table';

export default function RecentCostCodesPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent cost codes" subtitle="The 25 most recently added cost-code records." />
        <RecentCostCodesTable />
      </main>
    </AppShell>
  );
}
