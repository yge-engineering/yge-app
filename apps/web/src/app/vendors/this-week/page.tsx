import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisWeekTable } from './this-week-table';

export default function VendorsThisWeekPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors added this week" subtitle="Vendors whose createdAt is within the past 7 days." />
        <ThisWeekTable />
      </main>
    </AppShell>
  );
}
