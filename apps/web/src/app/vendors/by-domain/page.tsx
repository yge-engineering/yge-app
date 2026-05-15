import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByDomainPanel } from './by-domain-panel';

export default function VendorsByDomainPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors by email domain" subtitle="Which email providers your vendors use." />
        <p className="mb-4 text-xs text-gray-600">
          Vendors with no email bucket under <em>missing</em>.
          See also <Link href="/vendors/missing-email" className="text-yge-blue-700 hover:underline">/vendors/missing-email</Link>{' '}
          and <Link href="/vendors/with-email" className="text-yge-blue-700 hover:underline">/vendors/with-email</Link>.
        </p>
        <ByDomainPanel />
      </main>
    </AppShell>
  );
}
