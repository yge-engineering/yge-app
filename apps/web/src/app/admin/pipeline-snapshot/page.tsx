import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { PipelineSnapshot } from './snapshot';

export default function PipelineSnapshotPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Pipeline snapshot" subtitle="Counts of jobs in each active pipeline stage, side by side." />
        <PipelineSnapshot />
      </main>
    </AppShell>
  );
}
