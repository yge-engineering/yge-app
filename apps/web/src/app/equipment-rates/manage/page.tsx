// /equipment-rates/manage — equipment rate book CRUD.
//
// Plain English: owned iron has a bare $/hr + fuel $/hr that adds
// to a total $/hr the estimator uses. Rentals have daily / weekly /
// monthly costs. Both shapes live here; the form switches based on
// the row's `kind`.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EquipmentRateManager } from './equipment-rate-manager';

export default function EquipmentRatesManagePage() {
  requirePermission('financials:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Equipment rates"
          subtitle="Owned-iron bare/fuel/total $/hr and rental day/week/month costs. Estimates pull from this book by cost code."
        />
        <EquipmentRateManager />
      </main>
    </AppShell>
  );
}
