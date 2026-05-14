import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByStatusDetail } from './detail-panel';

export default function ByStatusDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by status (detail)" subtitle="Expand each status bucket to see the roster." />
        <ByStatusDetail />
      </main>
    </AppShell>
  );
}
