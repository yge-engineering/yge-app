import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthTable } from './by-month-table';

export default function BidsByMonthPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid history by month" subtitle="Month-over-month win/loss counts plus total won $." />
        <ByMonthTable />
      </main>
    </AppShell>
  );
}
