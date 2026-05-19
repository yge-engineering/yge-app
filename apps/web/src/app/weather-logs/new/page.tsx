// /weather-logs/new — log a day's weather.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { WeatherLogNewForm } from './weather-log-new-form';

export default function NewWeatherLogPage() {
  requirePermission('field:editAssigned');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <PageHeader
          title="New weather log"
          subtitle="Document today's weather + lost hours + heat-illness procedure activations."
        />
        <WeatherLogNewForm />
      </main>
    </AppShell>
  );
}
