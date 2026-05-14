import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CrossTab } from './cross-tab';

export default function ByStateAndKindPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Vendors by state x kind" subtitle="Cross-tab of vendor counts." />
        <CrossTab />
      </main>
    </AppShell>
  );
}
