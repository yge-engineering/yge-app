import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TwoDPanel } from './two-d-panel';

export default function JobsByStatusAndOwnerAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Jobs by status + owner agency" subtitle="2D grid: status down the side, top owner agencies across the top." />
        <p className="mb-4 text-xs text-gray-600">
          Spot how the active backlog is distributed across agencies. Drill-down via{' '}
          <Link href="/jobs/by-status" className="text-yge-blue-700 hover:underline">/jobs/by-status</Link>{' '}
          and <Link href="/jobs" className="text-yge-blue-700 hover:underline">/jobs</Link>.
        </p>
        <TwoDPanel />
      </main>
    </AppShell>
  );
}
