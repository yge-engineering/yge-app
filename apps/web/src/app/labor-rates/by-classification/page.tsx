import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByClassificationTable } from './by-classification-table';

export default function LaborRatesByClassPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Labor rates by classification" subtitle="Active labor rate records grouped by classification code." />
        <ByClassificationTable />
      </main>
    </AppShell>
  );
}
