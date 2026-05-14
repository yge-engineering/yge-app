import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { BiggestWinsTable } from './biggest-wins-table';

export default function BiggestWinsPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Biggest wins" subtitle="Top 25 YGE wins by bid amount across the company history." />
        <BiggestWinsTable />
      </main>
    </AppShell>
  );
}
