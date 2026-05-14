import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterTable } from './this-quarter-table';

export default function VendorsThisQuarterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors added this quarter" subtitle="Vendor records with createdAt in the current calendar quarter." />
        <ThisQuarterTable />
      </main>
    </AppShell>
  );
}
