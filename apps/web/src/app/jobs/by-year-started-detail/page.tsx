import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearStartedDetailPanel } from './by-year-started-detail-panel';

export default function JobsByYearStartedDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by year started (detail)" subtitle="Each year expands to the actual jobs that started in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/jobs/by-year-started" className="text-yge-blue-700 hover:underline">/jobs/by-year-started</Link>.
        </p>
        <ByYearStartedDetailPanel />
      </main>
    </AppShell>
  );
}
