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
import { getLocale, getTranslator } from '../../lib/locale';
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
  const t = getTranslator();
  const locale = getLocale();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('weather.title')}
          subtitle={t('weather.subtitle')}
          actions={
            <LinkButton href="/weather/new" variant="primary" size="md">
              {t('weather.logDay')}
            </LinkButton>
          }
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <Tile label={t('weather.tile.daysLogged')} value={rollup.total} />
          <Tile label={t('weather.tile.lostHours')} value={rollup.totalLostHours} />
          <Tile
            label={t('weather.tile.heatTrigger')}
            value={t('weather.tile.heatTrigger.value', { count: rollup.heatTriggerDays, high: rollup.highHeatTriggerDays })}
            warn={rollup.heatTriggerDays > 0}
          />
          <Tile
            label={t('weather.tile.gaps')}
            value={rollup.heatComplianceGaps}
            warn={rollup.heatComplianceGaps > 0}
            warnText={rollup.heatComplianceGaps > 0 ? t('weather.tile.gaps.warn') : undefined}
          />
        </section>

        {logs.length === 0 ? (
          <EmptyState
            title={t('weather.empty.title')}
            body={t('weather.empty.body')}
            actions={[{ href: '/weather/new', label: t('weather.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={logs}
            keyFn={(w) => w.id}
            columns={[
              {
                key: 'observedOn',
                header: t('weather.col.date'),
                cell: (w) => (
                  <Link href={`/weather/${w.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {w.observedOn}
                  </Link>
                ),
              },
              {
                key: 'jobId',
                header: t('weather.col.job'),
                cell: (w) => (
                  <Link href={`/jobs/${w.jobId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {w.jobId}
                  </Link>
                ),
              },
              {
                key: 'highLow',
                header: t('weather.col.highLow'),
                numeric: true,
                cell: (w) => (
                  <span className="font-mono text-xs text-gray-700">
                    {w.highF != null ? `${w.highF}°F` : '—'} / {w.lowF != null ? `${w.lowF}°F` : '—'}
                  </span>
                ),
              },
              {
                key: 'precip',
                header: t('weather.col.precip'),
                numeric: true,
                cell: (w) => (
                  <span className="font-mono text-xs text-gray-700">
                    {w.precipHundredthsInch != null ? `${(w.precipHundredthsInch / 100).toFixed(2)}"` : '—'}
                  </span>
                ),
              },
              {
                key: 'condition',
                header: t('weather.col.conditions'),
                cell: (w) => <span className="text-xs text-gray-700">{weatherConditionLabel(w.primaryCondition, locale)}</span>,
              },
              {
                key: 'impact',
                header: t('weather.col.impact'),
                cell: (w) => <StatusPill label={weatherImpactLabel(w.impact, locale)} tone={impactTone(w.impact)} />,
              },
              {
                key: 'lostHours',
                header: t('weather.col.lostHrs'),
                numeric: true,
                cell: (w) => <span className="font-mono text-sm">{w.lostHours}</span>,
              },
              {
                key: 'heat',
                header: '§3395',
                cell: (w) => {
                  const gap = heatComplianceGap(w);
                  const flag = gap.missingHeatActivation || gap.missingHighHeatActivation;
                  if (flag) return <span className="text-xs font-semibold text-red-700">{t('weather.heat.gap')}</span>;
                  if (w.heatProceduresActivated || w.highHeatProceduresActivated) {
                    return <span className="text-xs text-green-700">{t('weather.heat.active')}</span>;
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
