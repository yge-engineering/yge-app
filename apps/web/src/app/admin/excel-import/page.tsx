// /admin/excel-import — upload the YGE Job Cost System workbook
// and run the master-tables import.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ExcelImportForm } from '../../../components/excel-import-form';

export default function ExcelImportPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Excel import"
          subtitle="Import the master rate tables, cost codes, subs, employees, jobs, and estimates from the YGE Job Cost System workbook."
        />
        <ExcelImportForm />
      </main>
    </AppShell>
  );
}
