import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CrossTab } from './cross-tab';

export default function ByOutcomeAndYearPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid outcomes x year" subtitle="Cross-tab grid: outcome rows, year columns." />
        <CrossTab />
      </main>
    </AppShell>
  );
}
