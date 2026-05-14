import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { SubmittedList } from './submitted-list';

export default function SubmittedEstimatesPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Submitted bids" subtitle="Estimates marked submitted (timestamps captured in notes)." />
        <SubmittedList />
      </main>
    </AppShell>
  );
}
