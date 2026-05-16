import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StartDateStatsPanel } from './start-date-stats-panel';

export default function JobsWithStartDateStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs with start date (stats)" subtitle="How complete the startDate field is across the job roster." />
        <p className="mb-4 text-xs text-gray-600">
          For the lists see <Link href="/jobs/by-month-started" className="text-yge-blue-700 hover:underline">/jobs/by-month-started</Link>{' '}
          and <Link href="/jobs/by-year-started" className="text-yge-blue-700 hover:underline">/jobs/by-year-started</Link>.
        </p>
        <StartDateStatsPanel />
      </main>
    </AppShell>
  );
}
