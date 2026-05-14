import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CountsTable } from './counts-table';

export default function DataQualityCountsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Data quality counts" subtitle="How many records sit in each missing-field bucket, all on one screen." />
        <CountsTable />
      </main>
    </AppShell>
  );
}
