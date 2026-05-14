import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingStateTable } from './missing-table';

export default function MissingStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors missing state" subtitle="Records without a state code, useful before chasing W-9s." />
        <MissingStateTable />
      </main>
    </AppShell>
  );
}
