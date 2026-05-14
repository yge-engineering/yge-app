import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CustomerSearchClient } from './search-client';

export default function CustomerSearchPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Search customers" subtitle="Find by name, contact, or email." />
        <CustomerSearchClient />
      </main>
    </AppShell>
  );
}
