import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearTable } from './by-year-table';

export default function BidsByYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Bid history by year"
          subtitle="YoY bid count, wins, losses, win rate, and total won $."
        />
        <ByYearTable />
      </main>
    </AppShell>
  );
}
