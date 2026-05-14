import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { Last7DaysSnapshot } from './snapshot';

export default function Last7DaysPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Last 7 days" subtitle="Recent activity counts across the major modules." />
        <Last7DaysSnapshot />
      </main>
    </AppShell>
  );
}
