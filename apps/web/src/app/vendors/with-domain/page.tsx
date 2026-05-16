import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithDomainPanel } from './with-domain-panel';

export default function VendorsWithDomainPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors with email domain" subtitle="Vendors whose email has a recognisable domain (everything after @)." />
        <p className="mb-4 text-xs text-gray-600">
          Opposite of <Link href="/vendors/missing-email" className="text-yge-blue-700 hover:underline">/vendors/missing-email</Link>.
          Compare to <Link href="/vendors/by-domain" className="text-yge-blue-700 hover:underline">/vendors/by-domain</Link>.
        </p>
        <WithDomainPanel />
      </main>
    </AppShell>
  );
}
