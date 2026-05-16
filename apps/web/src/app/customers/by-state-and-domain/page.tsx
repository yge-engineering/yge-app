import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TwoDPanel } from './two-d-panel';

export default function CustomersByStateAndDomainPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Customers by state + email domain" subtitle="2D grid: state down the side, top email domains across the top." />
        <p className="mb-4 text-xs text-gray-600">
          Useful for spotting agency clusters. Drill-down via{' '}
          <Link href="/customers/by-state" className="text-yge-blue-700 hover:underline">/customers/by-state</Link>{' '}
          and <Link href="/customers/by-domain" className="text-yge-blue-700 hover:underline">/customers/by-domain</Link>.
        </p>
        <TwoDPanel />
      </main>
    </AppShell>
  );
}
