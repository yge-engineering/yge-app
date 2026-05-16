import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MonthStartedStatsPanel } from './month-started-stats-panel';

export default function JobsByMonthStartedStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by month started (stats)" subtitle="Quick stats card: busiest start month, unique months, missing start dates." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/jobs/by-month-started" className="text-yge-blue-700 hover:underline">/jobs/by-month-started</Link>{' '}
          and <Link href="/jobs/by-month-started-detail" className="text-yge-blue-700 hover:underline">/jobs/by-month-started-detail</Link>.
        </p>
        <MonthStartedStatsPanel />
      </main>
    </AppShell>
  );
}
