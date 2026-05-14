import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TbdTable } from './tbd-table';

export default function TbdPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Bids awaiting decision" subtitle="Bid results still in TBD status — chase these down." />
        <TbdTable />
      </main>
    </AppShell>
  );
}
