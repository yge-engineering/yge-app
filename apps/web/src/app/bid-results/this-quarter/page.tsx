import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterTable } from './this-quarter-table';

export default function ThisQuarterPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bid results — this quarter" subtitle="Bid tabs opened in the current calendar quarter." />
        <ThisQuarterTable />
      </main>
    </AppShell>
  );
}
