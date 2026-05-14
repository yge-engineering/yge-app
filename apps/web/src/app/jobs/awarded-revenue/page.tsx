import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AwardedRevenueTable } from './awarded-revenue-table';

export default function AwardedRevenuePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Awarded revenue by year" subtitle="Trailing revenue view for bonding underwriters." />
        <AwardedRevenueTable />
      </main>
    </AppShell>
  );
}
