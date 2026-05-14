import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WinsTable } from './wins-table';

export default function WinsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="YGE wins" subtitle="Every bid result with outcome WON_BY_YGE, newest first." />
        <WinsTable />
      </main>
    </AppShell>
  );
}
