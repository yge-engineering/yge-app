import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CrossTab } from './cross-tab';

export default function ByStatusAndYearPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs status x year" subtitle="Cross-tab grid: status rows, year columns (createdAt year)." />
        <CrossTab />
      </main>
    </AppShell>
  );
}
