import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function BidResultsThisYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bid results — this year" subtitle="Every recorded bid result with a bidOpenedAt in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
