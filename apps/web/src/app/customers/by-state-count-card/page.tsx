import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StateCountCardPanel } from './state-count-card-panel';

export default function CustomersByStateCountCardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Customer states (count)" subtitle="One big tile with how many distinct US states the customer list spans." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/customers/by-state" className="text-yge-blue-700 hover:underline">/customers/by-state</Link>.
        </p>
        <StateCountCardPanel />
      </main>
    </AppShell>
  );
}
