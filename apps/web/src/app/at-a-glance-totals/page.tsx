import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { TotalsPanel } from './totals-panel';

export default function AtAGlanceTotalsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="At-a-glance totals" subtitle="Customers, vendors, jobs and employees — one row, one glance." />
        <p className="mb-4 text-xs text-gray-600">
          Drill into the individual tiles via{' '}
          <Link href="/customers/total-count-card" className="text-yge-blue-700 hover:underline">customers</Link>{' '}·{' '}
          <Link href="/vendors/total-count-card" className="text-yge-blue-700 hover:underline">vendors</Link>{' '}·{' '}
          <Link href="/jobs/total-count-card" className="text-yge-blue-700 hover:underline">jobs</Link>{' '}·{' '}
          <Link href="/employees/total-count-card" className="text-yge-blue-700 hover:underline">employees</Link>.
        </p>
        <TotalsPanel />
      </main>
    </AppShell>
  );
}
