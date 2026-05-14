import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AwardedByAgency } from './stats-panel';

export default function AwardedByAgencyPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Awarded jobs by agency" subtitle="Count of jobs in AWARDED / ACTIVE / CLOSED grouped by owner agency." />
        <AwardedByAgency />
      </main>
    </AppShell>
  );
}
