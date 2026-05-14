import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCategoryStats } from './stats-panel';

export default function ByCategoryStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Materials by category — stats" subtitle="Count + share of material records per category." />
        <ByCategoryStats />
      </main>
    </AppShell>
  );
}
