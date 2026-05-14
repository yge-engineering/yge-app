import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByZipTable } from './by-zip-table';

export default function CustomersByZipPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by zip" subtitle="Top zip codes by customer count." />
        <ByZipTable />
      </main>
    </AppShell>
  );
}
