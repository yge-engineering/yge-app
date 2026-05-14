import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { SearchClient } from './search-client';

export default function ImportedEstimatesSearchPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Search bids"
          subtitle="Find an imported estimate by project name, client, job #, notes, or any line description / cost code."
        />
        <SearchClient />
      </main>
    </AppShell>
  );
}
