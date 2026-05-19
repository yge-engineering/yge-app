// /swppp-inspections/new — log a stormwater inspection.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { SwpppInspectionNewForm } from './swppp-inspection-new-form';

export default function NewSwpppInspectionPage() {
  requirePermission('safety:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <PageHeader
          title="New SWPPP inspection"
          subtitle="Header fields only — the BMP checks (silt fences, inlet protection, stabilized entrances, etc.) get filled in from the detail page in a follow-up."
        />
        <SwpppInspectionNewForm />
      </main>
    </AppShell>
  );
}
