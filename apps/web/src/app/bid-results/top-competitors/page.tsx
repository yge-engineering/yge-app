import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TopCompetitorsTable } from './top-competitors-table';

export default function TopCompetitorsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Top competitors" subtitle="Who shows up most in agency bid tabs and how often they win." />
        <TopCompetitorsTable />
      </main>
    </AppShell>
  );
}
