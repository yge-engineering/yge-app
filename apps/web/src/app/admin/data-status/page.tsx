import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DataStatusGrid } from './data-status-grid';

export default function DataStatusPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Master data status"
          subtitle="Record counts per entity — quickly spot wiped tables or onboarding gaps."
        />
        <DataStatusGrid />
      </main>
    </AppShell>
  );
}
