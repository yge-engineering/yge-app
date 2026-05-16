import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { YearStartedStatsPanel } from './year-started-stats-panel';

export default function JobsByYearStartedStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by year started (stats)" subtitle="Quick stats card: busiest start year, unique years, missing start dates." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/jobs/by-year-started" className="text-yge-blue-700 hover:underline">/jobs/by-year-started</Link>{' '}
          and <Link href="/jobs/by-year-started-detail" className="text-yge-blue-700 hover:underline">/jobs/by-year-started-detail</Link>.
        </p>
        <YearStartedStatsPanel />
      </main>
    </AppShell>
  );
}
