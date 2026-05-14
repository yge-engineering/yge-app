import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorsByKindTable } from './by-kind-table';

export default function VendorsByKindPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by kind" subtitle="Breakdown of vendors (subcontractor, supplier, service provider, etc.)." />
        <VendorsByKindTable />
      </main>
    </AppShell>
  );
}
