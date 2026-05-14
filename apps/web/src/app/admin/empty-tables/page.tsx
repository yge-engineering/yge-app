import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EmptyTables } from './empty-tables-panel';

export default function EmptyTablesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Empty tables" subtitle="Entities that have zero records — onboarding gaps." />
        <EmptyTables />
      </main>
    </AppShell>
  );
}
