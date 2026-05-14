import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CostCodeImportForm } from './cost-code-import-form';

export default function CostCodeImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import cost codes" subtitle="CSV with code, name; optional category." />
        <CostCodeImportForm />
      </main>
    </AppShell>
  );
}
