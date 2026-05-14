import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LossesTable } from './losses-table';

export default function LossesPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="YGE losses" subtitle="Every bid result with outcome WON_BY_OTHER, newest first." />
        <LossesTable />
      </main>
    </AppShell>
  );
}
