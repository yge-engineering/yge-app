import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OutcomeSnapshot } from './snapshot';

export default function OutcomeSnapshotPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Outcome snapshot" subtitle="Lifetime counts of bid results in each outcome bucket, as tiles." />
        <OutcomeSnapshot />
      </main>
    </AppShell>
  );
}
