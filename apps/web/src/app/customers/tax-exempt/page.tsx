import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TaxExemptTable } from './tax-exempt-table';

export default function TaxExemptPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Tax-exempt customers" subtitle="Accounts flagged taxExempt=true — invoices should ship without sales tax." />
        <TaxExemptTable />
      </main>
    </AppShell>
  );
}
