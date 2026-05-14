import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRankTable } from './by-rank-table';

export default function ByRankPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bid results by YGE rank" subtitle="Where YGE finished on each bid (1 = apparent low)." />
        <ByRankTable />
      </main>
    </AppShell>
  );
}
