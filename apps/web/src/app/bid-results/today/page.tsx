import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function BidsTodayPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bid tabs opened today" subtitle="Every bid result with bidOpenedAt = today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
