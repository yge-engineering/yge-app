import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WonNoJobTable } from './won-no-job-table';

export default function WonNoJobPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Wins without a job record" subtitle="WON_BY_YGE bid results whose jobId does not match a job in the system — usually means the job needs to be created or relinked." />
        <WonNoJobTable />
      </main>
    </AppShell>
  );
}
