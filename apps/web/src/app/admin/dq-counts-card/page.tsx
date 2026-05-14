import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DqCountsCard } from './card-panel';

export default function DqCountsCardPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="DQ counts (single card)" subtitle="Total records needing cleanup across the master data, in one tile." />
        <DqCountsCard />
      </main>
    </AppShell>
  );
}
