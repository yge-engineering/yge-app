import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByPrefixDetail } from './detail-panel';

export default function ByPrefixDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Cost codes by prefix (detail)" subtitle="Expand each prefix to see the codes." />
        <ByPrefixDetail />
      </main>
    </AppShell>
  );
}
