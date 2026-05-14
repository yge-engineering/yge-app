import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorImportForm } from './vendor-import-form';

export default function VendorImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import vendors" subtitle="CSV with legalName + kind required; rest optional." />
        <VendorImportForm />
      </main>
    </AppShell>
  );
}
