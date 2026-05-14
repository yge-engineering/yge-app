import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByCategoryTable } from './by-category-table';

export default function MaterialsByCategoryPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Materials by category" subtitle="Records on the master materials list grouped by category." />
        <ByCategoryTable />
      </main>
    </AppShell>
  );
}
