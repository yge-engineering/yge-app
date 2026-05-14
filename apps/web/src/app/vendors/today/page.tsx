import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function VendorsTodayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors added today" subtitle="Vendor records whose createdAt is today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
