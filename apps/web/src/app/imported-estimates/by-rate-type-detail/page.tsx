import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByRateTypeDetail } from './detail-panel';

export default function ByRateTypeDetailPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported estimates by rate type (detail)" subtitle="Expand each rate type to see the workbook list." />
        <ByRateTypeDetail />
      </main>
    </AppShell>
  );
}
