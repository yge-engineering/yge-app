// 1803 — concentration page.
// 1799 — concentration page first-time marker.
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ConcentrationTable } from './concentration-table';

export default function CustomerConcentrationPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Customer revenue concentration"
          subtitle="Share of awarded/active/closed-job revenue per customer + HHI."
        />
        <ConcentrationTable />
      </main>
    </AppShell>
  );
}
