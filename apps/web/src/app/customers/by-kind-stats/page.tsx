import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByKindStats } from './stats-panel';

export default function ByKindStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by kind — stats" subtitle="Count + share of customers per kind, with view links." />
        <ByKindStats />
      </main>
    </AppShell>
  );
}
