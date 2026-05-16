import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OwnerAgencyCountCardPanel } from './owner-agency-count-card-panel';

export default function JobsByOwnerAgencyCountCardPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Job owner agencies (count)" subtitle="One big tile with how many distinct agencies have hired YGE." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see <Link href="/jobs/by-owner-agency" className="text-yge-blue-700 hover:underline">/jobs/by-owner-agency</Link>.
        </p>
        <OwnerAgencyCountCardPanel />
      </main>
    </AppShell>
  );
}
