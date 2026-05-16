import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TotalCountCardPanel } from './total-count-card-panel';

export default function CustomersTotalCountCardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Total customers" subtitle="One big tile with the total customer count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/customers" className="text-yge-blue-700 hover:underline">/customers</Link>.
          For breakdowns see{' '}
          <Link href="/customers/by-state" className="text-yge-blue-700 hover:underline">/customers/by-state</Link>,{' '}
          <Link href="/customers/by-area-code" className="text-yge-blue-700 hover:underline">/customers/by-area-code</Link>.
        </p>
        <TotalCountCardPanel />
      </main>
    </AppShell>
  );
}
