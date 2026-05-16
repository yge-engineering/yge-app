import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DomainStatsPanel } from './domain-stats-panel';

export default function VendorsByDomainStatsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by domain (stats)" subtitle="Quick stats card: top vendor email domain, unique-domain count, missing-email count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full breakdown see{' '}
          <Link href="/vendors/by-domain" className="text-yge-blue-700 hover:underline">/vendors/by-domain</Link>{' '}
          and <Link href="/vendors/by-domain-detail" className="text-yge-blue-700 hover:underline">/vendors/by-domain-detail</Link>.
        </p>
        <DomainStatsPanel />
      </main>
    </AppShell>
  );
}
