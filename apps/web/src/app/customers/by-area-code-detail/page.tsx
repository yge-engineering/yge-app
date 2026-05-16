import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AreaCodeDetailPanel } from './area-code-detail-panel';

export default function CustomersByAreaCodeDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by area code (detail)" subtitle="Each area code expands to the actual customers in that 3-digit prefix." />
        <p className="mb-4 text-xs text-gray-600">
          Companion drill-down for{' '}
          <Link href="/customers/by-area-code" className="text-yge-blue-700 hover:underline">/customers/by-area-code</Link>.
        </p>
        <AreaCodeDetailPanel />
      </main>
    </AppShell>
  );
}
