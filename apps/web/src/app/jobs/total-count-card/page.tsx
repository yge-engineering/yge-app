import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TotalCountCardPanel } from './total-count-card-panel';

export default function JobsTotalCountCardPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Total jobs" subtitle="One big tile with the total job count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/jobs" className="text-yge-blue-700 hover:underline">/jobs</Link>.
          For breakdowns see{' '}
          <Link href="/jobs/by-status" className="text-yge-blue-700 hover:underline">/jobs/by-status</Link>,{' '}
          <Link href="/jobs/by-year" className="text-yge-blue-700 hover:underline">/jobs/by-year</Link>.
        </p>
        <TotalCountCardPanel />
      </main>
    </AppShell>
  );
}
