// /weather-logs — per-day per-job weather observations.
//
// Plain English: a row per day per job documenting weather + lost
// hours. The contract clock pauses for excusable weather days, and
// California's heat-illness rule (T8 §3395) kicks in at 80°F + high-
// heat procedures at 95°F. Both depend on having this log in hand.

import Link from 'next/link';

import { AppShell, PageHeader, EmptyState } from '../../components';
import { requirePermission } from '../../lib/permissions';
import type {
  WeatherLog,
  WeatherImpact,
  WeatherCondition,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchLogs(): Promise<WeatherLog[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/weather-logs`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { logs?: WeatherLog[] };
    return json.logs ?? [];
  } catch {
    return [];
  }
}

const IMPACT_TONE: Record<WeatherImpact, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  PARTIAL: 'bg-amber-100 text-amber-800',
  STOPPED: 'bg-red-100 text-red-800',
};

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  CLEAR: 'Clear',
  PARTLY_CLOUDY: 'P. cloudy',
  OVERCAST: 'Overcast',
  LIGHT_RAIN: 'Light rain',
  HEAVY_RAIN: 'Heavy rain',
  SNOW: 'Snow',
  FOG: 'Fog',
  WIND: 'Wind',
  EXTREME_HEAT: 'Extreme heat',
  EXTREME_COLD: 'Extreme cold',
  OTHER: 'Other',
};

export default async function WeatherLogsPage() {
  requirePermission('field:view');
  const rows = await fetchLogs();
  rows.sort((a, b) => (a.observedOn < b.observedOn ? 1 : -1));

  const totalLost = rows.reduce((s, r) => s + r.lostHours, 0);
  const heatDays = rows.filter((r) => r.heatProceduresActivated || r.highHeatProceduresActivated).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Weather logs"
          subtitle="One row per day per job — temp, precip, wind, primary condition, lost hours, heat-illness procedure activations."
          actions={
            <Link
              href="/weather-logs/new"
              className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
            >
              + New log entry
            </Link>
          }
        />
        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Logs on file" value={rows.length} />
          <Tile label="Lost hours total" value={totalLost} tone={totalLost > 0 ? 'warn' : 'good'} />
          <Tile label="Heat-procedure days" value={heatDays} />
        </section>
        {rows.length === 0 ? (
          <EmptyState
            title="No weather logs yet"
            body="Log every workday. The contract clock pauses for excusable weather days — without the log, the agency won't grant the extension."
          />
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Condition</th>
                  <th className="px-3 py-2 text-right">High °F</th>
                  <th className="px-3 py-2 text-right">Low °F</th>
                  <th className="px-3 py-2 text-right">Precip in.</th>
                  <th className="px-3 py-2 text-right">Wind mph</th>
                  <th className="px-3 py-2 text-left">Impact</th>
                  <th className="px-3 py-2 text-right">Lost hr</th>
                  <th className="px-3 py-2 text-left">Heat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-mono text-xs">{r.observedOn}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.jobId}</td>
                    <td className="px-3 py-2 text-xs">{CONDITION_LABEL[r.primaryCondition]}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.highF ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.lowF ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.precipHundredthsInch == null ? '—' : (r.precipHundredthsInch / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.windMph ?? '—'}{r.gustMph ? ` / ${r.gustMph}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${IMPACT_TONE[r.impact]}`}>
                        {r.impact}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.lostHours || ''}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.highHeatProceduresActivated ? <span className="font-semibold text-red-700">HIGH</span> :
                       r.heatProceduresActivated ? <span className="font-semibold text-amber-700">on</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Tile({ label, value, tone = 'good' }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-yge-blue-900' : tone === 'warn' ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
