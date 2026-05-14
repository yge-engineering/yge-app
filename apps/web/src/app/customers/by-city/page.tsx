import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCityTable } from './by-city-table';

export default function CustomersByCityPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by city" subtitle="Top cities by customer count." />
        <ByCityTable />
      </main>
    </AppShell>
  );
}
