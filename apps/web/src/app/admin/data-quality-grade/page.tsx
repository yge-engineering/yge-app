import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { GradePanel } from './grade-panel';

export default function DataQualityGradePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Data quality grade" subtitle="One letter grade summarizing the master-data coverage." />
        <GradePanel />
      </main>
    </AppShell>
  );
}
