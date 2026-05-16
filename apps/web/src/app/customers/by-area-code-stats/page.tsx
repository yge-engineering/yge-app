import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AreaCodeStatsPanel } from './area-code-stats-panel';

export default function CustomersByAreaCodeStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by area code (stats)" subtitle="Quick stats card: most-common area code, unique-code count, missing-phone count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full breakdown see{' '}
          <Link href="/customers/by-area-code" className="text-yge-blue-700 hover:underline">/customers/by-area-code</Link>{' '}
          and <Link href="/customers/by-area-code-detail" className="text-yge-blue-700 hover:underline">/customers/by-area-code-detail</Link>.
        </p>
        <AreaCodeStatsPanel />
      </main>
    </AppShell>
  );
}
