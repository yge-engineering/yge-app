// /weather — daily weather log.
//
// Plain English: per-job weather record. Backs delay-claim time
// extensions and documents §3395 heat-illness compliance (80°F base /
// 95°F high-heat). Refactored onto the shared component library
// (PageHeader / Tile / DataTable / StatusPill / EmptyState).

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  computeWeatherLogRollup,
  heatComplianceGap,
  weatherConditionLabel,
  weatherImpactLabel,
  type WeatherLog,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchLogs(filter: { jobId?: string }): Promise<WeatherLog[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/weather-logs`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { logs: WeatherLog[] }).logs;
  } catch {
    return [];
  }
}

function impactTone(impact: WeatherLog['impact']): 'success' | 'warn' | 'danger' | 'neutral' {
  switch (impact) {
    case 'STOPPED':
      return 'danger';
    case 'PARTIAL':
      return 'warn';
    case 'NONE':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export default async function WeatherPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const logs = await fetchLogs(searchParams);
  const rollup = computeWeatherLogRollup(logs);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Weather log"
          subtitle="Daily per-job weather record. Backs delay-claim time extensions and documents §3395 heat-illness compliance (80°F base / 95°F high-heat)."
          actions={
            <LinkButton href="/weather/new" variant="primary" size="md">
              + Log day
            </LinkButton>
          }
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <Tile label="Days logged" value={rollup.total} />
          <Tile label="Lost hours" value={rollup.totalLostHours} />
          <Tile
            label="Heat-trigger days"
            value={`${rollup.heatTriggerDays} (${rollup.highHeatTriggerDays} high)`}
            warn={rollup.heatTriggerDays > 0}
          />
          <Tile
            label="§3395 gaps"
            value={rollup.heatComplianceGaps}
            warn={rollup.heatComplianceGaps > 0}
            warnText={rollup.heatComplianceGaps > 0 ? 'Heat procedures missing on hot day' : undefined}
          />
        </section>

        {logs.length === 0 ? (
          <EmptyState
            title="No weather logs yet"
            body="Log a day's high/low, precip, and crew impact so delay-claim documentation and §3395 heat compliance live in the same place."
            actions={[{ href: '/weather/new', label: 'Log today', primary: true }]}
          />
        ) : (
          <DataTable
            rows={logs}
            keyFn={(w) => w.id}
            columns={[
              {
                key: 'observedOn',
                header: 'Date',
                cell: (w) => (
                  <Link href={`/weather/${w.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {w.observedOn}
                  </Link>
                ),
              },
              {
                key: 'jobId',
                header: 'Job',
                cell: (w) => (
                  <Link href={`/jobs/${w.jobId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {w.jobId}
                  </Link>
                ),
              },
              {
                key: 'highLow',
                header: 'High / Low',
                numeric: true,
                cell: (w) => (
                  <span className="font-mono text-xs text-gray-700">
                    {w.highF != null ? `${w.highF}°F` : '—'} / {w.lowF != null ? `${w.lowF}°F` : '—'}
                  </span>
                ),
              },
              {
                key: 'precip',
                header: 'Precip',
                numeric: true,
                cell: (w) => (
                  <span className="font-mono text-xs text-gray-700">
                    {w.precipHundredthsInch != null ? `${(w.precipHundredthsInch / 100).toFixed(2)}"` : '—'}
                  </span>
                ),
              },
              {
                key: 'condition',
                header: 'Conditions',
                cell: (w) => <span className="text-xs text-gray-700">{weatherConditionLabel(w.primaryCondition)}</span>,
              },
              {
                key: 'impact',
                header: 'Impact',
                cell: (w) => <StatusPill label={weatherImpactLabel(w.impact)} tone={impactTone(w.impact)} />,
              },
              {
                key: 'lostHours',
                header: 'Lost hrs',
                numeric: true,
                cell: (w) => <span className="font-mono text-sm">{w.lostHours}</span>,
              },
              {
                key: 'heat',
                header: '§3395',
                cell: (w) => {
                  const gap = heatComplianceGap(w);
                  const flag = gap.missingHeatActivation || gap.missingHighHeatActivation;
                  if (flag) return <span className="text-xs font-semibold text-red-700">GAP</span>;
                  if (w.heatProceduresActivated || w.highHeatProceduresActivated) {
                    return <span className="text-xs text-green-700">Active</span>;
                  }
                  return <span className="text-xs text-gray-400">—</span>;
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
