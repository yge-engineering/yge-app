import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { PinnedList } from './pinned-list';

export default function PinnedEstimatesPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="📌 Pinned bids" subtitle="Bids you're actively working on." />
        <PinnedList />
      </main>
    </AppShell>
  );
}
