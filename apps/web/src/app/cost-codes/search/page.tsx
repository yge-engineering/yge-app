import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CostCodeSearchClient } from './search-client';

export default function CostCodeSearchPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Search cost codes"
          subtitle="Find by code prefix, name, or category."
        />
        <CostCodeSearchClient />
      </main>
    </AppShell>
  );
}
