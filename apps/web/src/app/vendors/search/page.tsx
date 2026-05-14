import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorSearchClient } from './search-client';

export default function VendorSearchPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Search vendors" subtitle="Find by name, trade, or email." />
        <VendorSearchClient />
      </main>
    </AppShell>
  );
}
