import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DataOverviewTable } from './data-overview-table';

export default function DataOverviewPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Data overview" subtitle="Live record counts side-by-side with the quick-add link for each entity." />
        <DataOverviewTable />
      </main>
    </AppShell>
  );
}
