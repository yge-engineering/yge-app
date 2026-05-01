// /weather — daily weather log.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
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
  const url = new URL(`${apiBaseUrl()}/api/weather-logs`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { logs: WeatherLog[] }).logs;
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
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/weather/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Log day
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Weather Log</h1>
      <p className="mt-2 text-gray-700">
        Daily per-job weather record. Backs delay-claim time extensions and
        documents §3395 heat-illness compliance (80°F base / 95°F high-heat).
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Days logged" value={rollup.total} />
        <Stat label="Lost hours" value={rollup.totalLostHours} />
        <Stat
          label="Heat-trigger days"
          value={`${rollup.heatTriggerDays} (${rollup.highHeatTriggerDays} high)`}
          variant={rollup.heatTriggerDays > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="§3395 gaps"
          value={rollup.heatComplianceGaps}
          variant={rollup.heatComplianceGaps > 0 ? 'bad' : 'ok'}
        />
      </section>

      {logs.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No weather logs yet. Click <em>Log day</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2 text-right">High / Low</th>
                <th className="px-4 py-2 text-right">Precip</th>
                <th className="px-4 py-2">Conditions</th>
                <th className="px-4 py-2">Impact</th>
                <th className="px-4 py-2 text-right">Lost hrs</th>
                <th className="px-4 py-2">§3395</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((w) => {
                const gap = heatComplianceGap(w);
                const flag = gap.missingHeatActivation || gap.missingHighHeatActivation;
                return (
                  <tr key={w.id} className={flag ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-xs text-gray-700">{w.observedOn}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{w.jobId}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                      {w.highF != null ? `${w.highF}°F` : '—'} / {w.lowF != null ? `${w.lowF}°F` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                      {w.precipHundredthsInch != null
                        ? (w.precipHundredthsInch / 100).toFixed(2) + '"'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {weatherConditionLabel(w.primaryCondition)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                          w.impact === 'STOPPED'
                            ? 'bg-red-100 text-red-800'
                            : w.impact === 'PARTIAL'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {weatherImpactLabel(w.impact)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {w.lostHours}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {flag ? (
                        <span className="font-semibold text-red-700">GAP</span>
                      ) : w.heatProceduresActivated || w.highHeatProceduresActivated ? (
                        <span className="text-green-700">Active</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/weather/${w.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
