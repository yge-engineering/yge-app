import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function CustomersTodayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers added today" subtitle="Customer records whose createdAt is today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
