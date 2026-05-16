import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { MissingPanel } from './missing-panel';

export default function AtAGlanceMissingPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="At-a-glance missing" subtitle="One row of tiles showing how many records are missing key fields per entity." />
        <p className="mb-4 text-xs text-gray-600">
          Each tile is the sum of canonical missing-X counts for the entity.
          Drill down via{' '}
          <Link href="/customers/missing-email" className="text-yge-blue-700 hover:underline">customers</Link>,{' '}
          <Link href="/vendors/missing-state" className="text-yge-blue-700 hover:underline">vendors</Link>,{' '}
          <Link href="/jobs/missing-status" className="text-yge-blue-700 hover:underline">jobs</Link>,{' '}
          <Link href="/employees/missing-classification" className="text-yge-blue-700 hover:underline">employees</Link>.
        </p>
        <MissingPanel />
      </main>
    </AppShell>
  );
}
