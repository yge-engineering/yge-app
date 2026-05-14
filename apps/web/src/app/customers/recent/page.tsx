import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentCustomersTable } from './recent-table';

export default function RecentCustomersPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent customers" subtitle="The 25 most recently added customer records." />
        <RecentCustomersTable />
      </main>
    </AppShell>
  );
}
