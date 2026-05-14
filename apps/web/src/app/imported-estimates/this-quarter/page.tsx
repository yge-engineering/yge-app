import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterTable } from './this-quarter-table';

export default function EstimatesThisQuarterPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported estimates — this quarter" subtitle="Estimate workbooks touched in the current calendar quarter." />
        <ThisQuarterTable />
      </main>
    </AppShell>
  );
}
