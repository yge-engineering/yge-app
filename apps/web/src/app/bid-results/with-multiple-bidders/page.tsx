import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithMultipleBiddersTable } from './table';

export default function WithMultipleBiddersPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid tabs with multiple bidders" subtitle="Only bid results where two or more contractors submitted." />
        <WithMultipleBiddersTable />
      </main>
    </AppShell>
  );
}
