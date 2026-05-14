import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DataSummaryTiles } from './data-summary-tiles';

export default function DataSummaryPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Data summary" subtitle="High-level record counts as colored tiles for a quick visual scan." />
        <DataSummaryTiles />
      </main>
    </AppShell>
  );
}
