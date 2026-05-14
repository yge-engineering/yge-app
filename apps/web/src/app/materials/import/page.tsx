import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MaterialsImportForm } from './materials-import-form';

export default function MaterialsImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import materials" subtitle="Upload a CSV with columns code, name, unit, unitCost." />
        <MaterialsImportForm />
      </main>
    </AppShell>
  );
}
