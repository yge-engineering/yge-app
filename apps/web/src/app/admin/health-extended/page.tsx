import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { HealthExtendedPanel } from './health-extended-panel';

export default function HealthExtendedPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Health — extended" subtitle="Pings every analytic endpoint and renders the up/down result." />
        <HealthExtendedPanel />
      </main>
    </AppShell>
  );
}
