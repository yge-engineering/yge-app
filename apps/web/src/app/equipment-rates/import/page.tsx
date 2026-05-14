import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EquipmentImportForm } from './equipment-import-form';

export default function EquipmentImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import equipment rates" subtitle="CSV columns: code, name, kind (OWNED|RENTAL), hourlyRate (+ daily/weekly/monthly/vendor for RENTAL)." />
        <EquipmentImportForm />
      </main>
    </AppShell>
  );
}
