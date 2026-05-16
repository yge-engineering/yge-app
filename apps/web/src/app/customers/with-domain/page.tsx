import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WithDomainPanel } from './with-domain-panel';

export default function CustomersWithDomainPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers with email domain" subtitle="Customers whose email has a recognisable domain (everything after @)." />
        <p className="mb-4 text-xs text-gray-600">
          Opposite of <Link href="/customers/missing-email" className="text-yge-blue-700 hover:underline">/customers/missing-email</Link>.
          Compare to <Link href="/customers/by-domain" className="text-yge-blue-700 hover:underline">/customers/by-domain</Link>.
        </p>
        <WithDomainPanel />
      </main>
    </AppShell>
  );
}
