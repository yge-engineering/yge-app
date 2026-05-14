import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StalenessTable } from './staleness-table';

export default function MaterialsStalenessPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Material price freshness" subtitle="Which prices need a re-quote." />
        <StalenessTable />
      </main>
    </AppShell>
  );
}
