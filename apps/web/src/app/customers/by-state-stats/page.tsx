import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStateStats } from './stats-panel';

export default function ByStateStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by state — stats" subtitle="Count + share of customers per state code with view links." />
        <ByStateStats />
      </main>
    </AppShell>
  );
}
