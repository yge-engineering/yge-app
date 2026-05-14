import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LargestTables } from './largest-tables-panel';

export default function LargestTablesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Largest tables" subtitle="Master entities sorted by record count." />
        <LargestTables />
      </main>
    </AppShell>
  );
}
