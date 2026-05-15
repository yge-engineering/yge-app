import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RecentList } from './recent-list';

export default function VisitedRecentPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Visited recently" subtitle="The last 20 pages you opened in YGE, stored locally in your browser." />
        <p className="mb-4 text-xs text-gray-600">
          Nothing here is sent to the server — this only reads <code className="rounded bg-gray-100 px-1">localStorage</code>
          {' '}on this browser. Clearing your site data wipes it.
        </p>
        <RecentList />
      </main>
    </AppShell>
  );
}
