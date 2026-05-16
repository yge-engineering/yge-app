import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StatusCountCardPanel } from './status-count-card-panel';

export default function JobsByStatusCountCardPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Job statuses (count)" subtitle="One big tile with how many distinct statuses appear across the job roster." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/jobs/by-status" className="text-yge-blue-700 hover:underline">/jobs/by-status</Link>.
        </p>
        <StatusCountCardPanel />
      </main>
    </AppShell>
  );
}
