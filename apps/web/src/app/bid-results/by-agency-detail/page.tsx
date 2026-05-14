import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByAgencyDetail } from './detail-panel';

export default function ByAgencyDetailPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by agency (detail)" subtitle="Expand each agency to see its bid history." />
        <ByAgencyDetail />
      </main>
    </AppShell>
  );
}
