import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCityTable } from './by-city-table';

export default function VendorsByCityPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by city" subtitle="Top cities by vendor / subcontractor count." />
        <ByCityTable />
      </main>
    </AppShell>
  );
}
