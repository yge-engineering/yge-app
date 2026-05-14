import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ForecastDetail } from './forecast-detail';

export default function PipelineForecastPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Pipeline forecast"
          subtitle="Open bid $ × historical agency win rate = risk-adjusted backlog."
        />
        <ForecastDetail />
      </main>
    </AppShell>
  );
}
