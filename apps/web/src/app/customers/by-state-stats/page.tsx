import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StateStatsPanel } from './state-stats-panel';

export default function CustomersByStateStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by state (stats)" subtitle="Quick stats card: top state, unique-state count, missing-state count." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/customers/by-state" className="text-yge-blue-700 hover:underline">/customers/by-state</Link>{' '}
          and <Link href="/customers/by-state-detail" className="text-yge-blue-700 hover:underline">/customers/by-state-detail</Link>.
        </p>
        <StateStatsPanel />
      </main>
    </AppShell>
  );
}
