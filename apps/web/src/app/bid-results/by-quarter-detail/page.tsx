import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByQuarterDetail } from './detail-panel';

export default function BidsByQuarterDetailPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid results by quarter (detail)" subtitle="Expand each quarter to see its bid history." />
        <ByQuarterDetail />
      </main>
    </AppShell>
  );
}
