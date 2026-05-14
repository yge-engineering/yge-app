import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { NotOnHoldTable } from './not-on-hold-table';

export default function NotOnHoldPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers in good standing" subtitle="Active accounts not flagged on-hold — billable as usual." />
        <NotOnHoldTable />
      </main>
    </AppShell>
  );
}
