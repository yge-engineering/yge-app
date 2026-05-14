import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByPrefixStats } from './stats-panel';

export default function ByPrefixStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cost codes by prefix — stats" subtitle="Count + share of cost codes grouped by 3-letter prefix." />
        <ByPrefixStats />
      </main>
    </AppShell>
  );
}
