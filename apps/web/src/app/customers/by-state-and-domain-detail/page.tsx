import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { StateDomainDetailPanel } from './state-domain-detail-panel';

export default function CustomersByStateAndDomainDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by state + domain (detail)" subtitle="Each (state, email domain) bucket expands to the actual customers in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/customers/by-state-and-domain" className="text-yge-blue-700 hover:underline">/customers/by-state-and-domain</Link>.
        </p>
        <StateDomainDetailPanel />
      </main>
    </AppShell>
  );
}
