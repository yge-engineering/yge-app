import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthStartedDetailPanel } from './by-month-started-detail-panel';

export default function JobsByMonthStartedDetailPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by month started (detail)" subtitle="Each YYYY-MM month expands to the actual jobs that started in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/jobs/by-month-started" className="text-yge-blue-700 hover:underline">/jobs/by-month-started</Link>.
        </p>
        <ByMonthStartedDetailPanel />
      </main>
    </AppShell>
  );
}
