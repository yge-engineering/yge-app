import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CustomersByKindTable } from './by-kind-table';

export default function CustomersByKindPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by kind" subtitle="Breakdown of customers (agency, private, prime, sub, etc.)." />
        <CustomersByKindTable />
      </main>
    </AppShell>
  );
}
