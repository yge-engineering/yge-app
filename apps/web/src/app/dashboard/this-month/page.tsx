import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThisMonthSnapshot } from './snapshot';

export default function ThisMonthPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="This month at a glance" subtitle="Activity counts in the current calendar month." />
        <ThisMonthSnapshot />
      </main>
    </AppShell>
  );
}
