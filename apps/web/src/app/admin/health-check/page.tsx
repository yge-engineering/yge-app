import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { HealthCheckPanel } from './health-panel';

export default function HealthCheckPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Health check" subtitle="Live snapshot from /api/admin/health — API, DB, dependent services." />
        <HealthCheckPanel />
      </main>
    </AppShell>
  );
}
