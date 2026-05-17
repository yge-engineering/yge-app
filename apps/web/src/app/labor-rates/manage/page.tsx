// /labor-rates/manage — labor rate book CRUD admin.
//
// Lists active labor rates with inline edit (burden %, the four
// rate-type base cents, effective dates, source) and an "Add rate"
// form. Soft-delete via the row action. Permission-gated to
// financials:edit since rates feed estimate pricing.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { LaborRateManager } from './labor-rate-manager';

export default function LaborRatesManagePage() {
  requirePermission('financials:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Labor rates"
          subtitle="The hourly cost per classification, with separate columns for private / CA prevailing wage / Davis-Bacon / IBEW. Updates ripple into every new estimate."
        />
        <LaborRateManager />
      </main>
    </AppShell>
  );
}
