import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentActivityFeed } from './activity-feed';

export default function RecentActivityPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Recent activity" subtitle="Most recent touch across jobs, bid results, vendors, and customers." />
        <RecentActivityFeed />
      </main>
    </AppShell>
  );
}
