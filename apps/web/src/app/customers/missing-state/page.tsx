import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingStateTable } from './missing-state-table';

export default function MissingStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers missing state" subtitle="Records without a state code — drags down geographic reporting." />
        <MissingStateTable />
      </main>
    </AppShell>
  );
}
