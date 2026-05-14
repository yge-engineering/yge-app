// /equipment-rates/usage — equipment usage rollup.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EquipmentUsageTable } from './equipment-usage-table';

export default function EquipmentUsagePage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Equipment usage"
          subtitle="Bid vs Actual hours and $ per piece of equipment across every job."
        />
        <EquipmentUsageTable />
      </main>
    </AppShell>
  );
}
