import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StateCountCardPanel } from './state-count-card-panel';

export default function VendorsByStateCountCardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Vendor states (count)" subtitle="One big tile with how many distinct US states the vendor list spans." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/vendors/by-state" className="text-yge-blue-700 hover:underline">/vendors/by-state</Link>.
        </p>
        <StateCountCardPanel />
      </main>
    </AppShell>
  );
}
