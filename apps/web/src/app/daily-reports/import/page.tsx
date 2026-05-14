import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DailyReportImportForm } from './daily-report-import-form';

export default function DailyReportImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import daily reports" subtitle="CSV columns: date, jobNumber, category, costCode, description, qtyHrs, unit, rate, totalCost, employeeVendor, notes." />
        <DailyReportImportForm />
      </main>
    </AppShell>
  );
}
