import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByDomainDetailPanel } from './by-domain-detail-panel';

export default function VendorsByDomainDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors by email domain (detail)" subtitle="Each email domain expands to the actual vendors using it." />
        <p className="mb-4 text-xs text-gray-600">
          Companion drill-down for{' '}
          <Link href="/vendors/by-domain" className="text-yge-blue-700 hover:underline">/vendors/by-domain</Link>.
        </p>
        <ByDomainDetailPanel />
      </main>
    </AppShell>
  );
}
