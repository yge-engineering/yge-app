import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TrendsTable } from './trends-table';

export default function CostCodeTrendsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Cost code price trends"
          subtitle="Most recent unit cost vs the prior bid — climbing/falling/flat."
        />
        <TrendsTable />
      </main>
    </AppShell>
  );
}
