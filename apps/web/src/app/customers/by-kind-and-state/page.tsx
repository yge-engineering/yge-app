import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CrossTab } from './cross-tab';

export default function ByKindAndStatePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by kind x state" subtitle="Cross-tab of customer counts (kind rows, state columns)." />
        <CrossTab />
      </main>
    </AppShell>
  );
}
