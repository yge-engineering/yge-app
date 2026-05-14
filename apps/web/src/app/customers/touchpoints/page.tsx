import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TouchpointsTable } from './touchpoints-table';

export default function CustomerTouchpointsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Customer touchpoints"
          subtitle="Who haven't we talked to recently — sorted dormant-first."
        />
        <TouchpointsTable />
      </main>
    </AppShell>
  );
}
