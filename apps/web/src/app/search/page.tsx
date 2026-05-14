import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { SearchPanel } from './search-panel';

export default function SearchPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Search" subtitle="One box, three masters. Customers + vendors + jobs." />
        <SearchPanel />
      </main>
    </AppShell>
  );
}
