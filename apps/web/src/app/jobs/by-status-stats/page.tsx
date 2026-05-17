import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StatusStatsPanel } from './status-stats-panel';

export default function JobsByStatusStatsPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by status (stats)" subtitle="Quick stats card: top status, unique-status count, missing-status count." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/jobs/by-status" className="text-yge-blue-700 hover:underline">/jobs/by-status</Link>{' '}
          and <Link href="/jobs/by-status-detail" className="text-yge-blue-700 hover:underline">/jobs/by-status-detail</Link>.
        </p>
        <StatusStatsPanel />
      </main>
    </AppShell>
  );
}
