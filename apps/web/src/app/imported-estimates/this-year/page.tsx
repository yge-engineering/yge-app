import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisYearTable } from './this-year-table';

export default function EstimatesThisYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported estimates — this year" subtitle="Estimate workbooks updated or saved in the current calendar year." />
        <ThisYearTable />
      </main>
    </AppShell>
  );
}
