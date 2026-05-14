import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CustomerCsvImportForm } from '../../../components/customer-csv-import-form';

export default function CustomerImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import customers" subtitle="CSV with legalName + kind required." />
        <CustomerCsvImportForm />
      </main>
    </AppShell>
  );
}
