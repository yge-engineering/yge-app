import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByClassDetail } from './detail-panel';

export default function ByClassDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by classification (detail)" subtitle="Expand each classification to see the roster." />
        <ByClassDetail />
      </main>
    </AppShell>
  );
}
