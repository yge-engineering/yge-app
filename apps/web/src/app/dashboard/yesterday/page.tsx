import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { YesterdayPanel } from './snapshot';

export default function YesterdayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Yesterday at a glance" subtitle="What landed in the system the day before today." />
        <YesterdayPanel />
      </main>
    </AppShell>
  );
}
