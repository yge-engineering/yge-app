import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByClassStats } from './stats-panel';

export default function ByClassStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by classification — stats" subtitle="Count + share of employees per classification, with view links." />
        <ByClassStats />
      </main>
    </AppShell>
  );
}
