import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TotalCountCardPanel } from './total-count-card-panel';

export default function VendorsTotalCountCardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Total vendors" subtitle="One big tile with the total vendor count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/vendors" className="text-yge-blue-700 hover:underline">/vendors</Link>.
          For breakdowns see{' '}
          <Link href="/vendors/by-state" className="text-yge-blue-700 hover:underline">/vendors/by-state</Link>,{' '}
          <Link href="/vendors/by-kind" className="text-yge-blue-700 hover:underline">/vendors/by-kind</Link>.
        </p>
        <TotalCountCardPanel />
      </main>
    </AppShell>
  );
}
