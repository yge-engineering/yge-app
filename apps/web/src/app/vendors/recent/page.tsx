import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentVendorsTable } from './recent-table';

export default function RecentVendorsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent vendors" subtitle="The 25 most recently added vendor / sub records." />
        <RecentVendorsTable />
      </main>
    </AppShell>
  );
}
