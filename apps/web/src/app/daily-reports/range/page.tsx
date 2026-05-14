import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RangeClient } from './range-client';

export default function DailyReportsRangePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Daily reports — date range"
          subtitle="Pull totals (lines + $) across a date range, optionally scoped to one job."
        />
        <RangeClient />
      </main>
    </AppShell>
  );
}
