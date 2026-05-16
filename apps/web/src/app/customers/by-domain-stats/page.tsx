import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DomainStatsPanel } from './domain-stats-panel';

export default function CustomersByDomainStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by domain (stats)" subtitle="Quick stats card: top domain, unique-domain count, missing-email count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full breakdown see{' '}
          <Link href="/customers/by-domain" className="text-yge-blue-700 hover:underline">/customers/by-domain</Link>{' '}
          and <Link href="/customers/by-domain-detail" className="text-yge-blue-700 hover:underline">/customers/by-domain-detail</Link>.
        </p>
        <DomainStatsPanel />
      </main>
    </AppShell>
  );
}
