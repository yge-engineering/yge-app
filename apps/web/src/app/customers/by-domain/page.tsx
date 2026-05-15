import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByDomainPanel } from './by-domain-panel';

export default function CustomersByDomainPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by email domain" subtitle="Which email providers your customers use — handy for spotting bulk sign-ups or duplicate agencies." />
        <p className="mb-4 text-xs text-gray-600">
          Customers with no email bucket under <em>missing</em>.
          See also <Link href="/customers/missing-email" className="text-yge-blue-700 hover:underline">/customers/missing-email</Link>{' '}
          and <Link href="/customers/with-email" className="text-yge-blue-700 hover:underline">/customers/with-email</Link>.
        </p>
        <ByDomainPanel />
      </main>
    </AppShell>
  );
}
