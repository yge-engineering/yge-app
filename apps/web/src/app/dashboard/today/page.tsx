import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayPanel } from './today-panel';

export default function TodayPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Today" subtitle="What needs your attention right now." />
        <TodayPanel />
      </main>
    </AppShell>
  );
}
