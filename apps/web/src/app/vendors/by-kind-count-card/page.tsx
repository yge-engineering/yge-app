import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { KindCountCardPanel } from './kind-count-card-panel';

export default function VendorsByKindCountCardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Vendor kinds (count)" subtitle="One big tile with how many distinct kinds appear across the vendor list." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/vendors/by-kind" className="text-yge-blue-700 hover:underline">/vendors/by-kind</Link>.
        </p>
        <KindCountCardPanel />
      </main>
    </AppShell>
  );
}
