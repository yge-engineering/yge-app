import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisQuarterSnapshot } from './snapshot';

export default function ThisQuarterDashboardPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="This quarter at a glance" subtitle="Activity counts in the current calendar quarter." />
        <ThisQuarterSnapshot />
      </main>
    </AppShell>
  );
}
