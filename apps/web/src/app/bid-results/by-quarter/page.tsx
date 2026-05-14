import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByQuarterTable } from './by-quarter-table';

export default function BidsByQuarterPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid history by quarter" subtitle="Wins / losses / won $ rolled up by calendar quarter." />
        <ByQuarterTable />
      </main>
    </AppShell>
  );
}
