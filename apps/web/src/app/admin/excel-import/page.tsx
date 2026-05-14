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
      
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">4 · Daily Reports</h2>
          <p className="mb-3 text-sm text-gray-600">
            Imports the "Daily Report" sheet — one row per line item, grouped by job + date into DailyReport records.
          </p>
          <UploadForm endpoint="/api/admin/excel-import/daily-reports" label="Import Daily Reports" />
        </section>
      </main>
    </AppShell>
  );
}
