import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByZipTable } from './by-zip-table';

export default function VendorsByZipPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by zip" subtitle="Top zip codes by vendor count." />
        <ByZipTable />
      </main>
    </AppShell>
  );
}
