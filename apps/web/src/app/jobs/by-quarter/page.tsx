import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByQuarterTable } from './by-quarter-table';

export default function JobsByQuarterPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by quarter" subtitle="New jobs grouped by calendar quarter, with awarded/lost split." />
        <ByQuarterTable />
      </main>
    </AppShell>
  );
}
