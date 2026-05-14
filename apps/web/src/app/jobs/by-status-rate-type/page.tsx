import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CrossTab } from './cross-tab';

export default function ByStatusRateTypePage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs status x rate type" subtitle="Counts of jobs grouped by status and rate type (PW vs Private)." />
        <CrossTab />
      </main>
    </AppShell>
  );
}
