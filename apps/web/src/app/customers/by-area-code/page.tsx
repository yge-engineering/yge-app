import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AreaCodePanel } from './area-code-panel';

export default function CustomersByAreaCodePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customers by area code" subtitle="Where your customers' phones are based — pulled from the first 3 digits of their primary phone." />
        <p className="mb-4 text-xs text-gray-600">
          Phones with no recognisable 3-digit prefix bucket under <em>unknown</em>.
          See also <Link href="/customers/by-state" className="text-yge-blue-700 hover:underline">/customers/by-state</Link>{' '}
          and <Link href="/customers/missing-phone" className="text-yge-blue-700 hover:underline">/customers/missing-phone</Link>.
        </p>
        <AreaCodePanel />
      </main>
    </AppShell>
  );
}
