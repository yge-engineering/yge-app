'use client';

// /paving-weather — go/no-go calculator wrapping the rule engine
// from packages/shared/src/paving-weather-window.ts.
//
// Foreman or estimator punches in surface temp + wet flag + wind +
// rain-soon hours + binder/surface, sees the verdict + the
// per-issue plain-English reason that goes in the daily-report
// delay note.

import { useMemo, useState } from 'react';
import { checkPavingWeather, type AcLiftKind } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const LIFT_OPTIONS: Array<{ value: AcLiftKind; label: string; hint: string }> = [
  { value: 'BINDER', label: 'Binder course', hint: 'min 50°F' },
  { value: 'SURFACE', label: 'Surface course', hint: 'min 60°F' },
];

export default function PavingWeatherPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [lift, setLift] = useState<AcLiftKind>('SURFACE');
  const [temp, setTemp] = useState('70');
  const [wet, setWet] = useState(false);
  const [rainHours, setRainHours] = useState('24');
  const [wind, setWind] = useState('8');

  const verdict = useMemo(
    () =>
      checkPavingWeather({
        date,
        lift,
        surfaceTempF: Number(temp) || 0,
        surfaceIsWet: wet,
        hoursToForecastRain: Number(rainHours),
        sustainedWindMph: Number(wind) || 0,
      }),
    [date, lift, temp, wet, rainHours, wind],
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <PageHeader
          title="Paving weather check"
          subtitle="Caltrans 39-3.02C(1) + AGC compaction practice. Foreman fills in field conditions, sees go/no-go plus the reason for the daily-report delay note."
        />

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-gray-700">Planned date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">Lift</span>
              <select
                value={lift}
                onChange={(e) => setLift(e.target.value as AcLiftKind)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              >
                {LIFT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} — {o.hint}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">Surface temp (°F)</span>
              <input
                type="number"
                inputMode="decimal"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm tabular-nums"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-gray-700">Sustained wind (mph)</span>
              <input
                type="number"
                inputMode="decimal"
                value={wind}
                onChange={(e) => setWind(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm tabular-nums"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-gray-700">Hours until forecast rain</span>
              <input
                type="number"
                inputMode="decimal"
                value={rainHours}
                onChange={(e) => setRainHours(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm tabular-nums"
              />
              <span className="mt-0.5 block text-xs text-gray-500">
                Enter a large number (e.g. 999) when no rain in the forecast.
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={wet}
                onChange={(e) => setWet(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">Existing surface is wet</span>
            </label>
          </div>
        </section>

        <section className="mt-6">
          {verdict.allowed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Verdict
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">
                ✓ Weather OK to pave ({lift.toLowerCase()})
              </div>
              <p className="mt-2 text-sm text-emerald-800">
                All Caltrans 39-3.02C(1) checks pass. Confirm at start-of-shift again — conditions can shift quickly.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Verdict
              </div>
              <div className="mt-1 text-2xl font-bold text-red-900">
                ✗ Do not pave today ({verdict.issues.length} blocker
                {verdict.issues.length === 1 ? '' : 's'})
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-900">
                {verdict.explanations.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-red-700">
                Copy the bullet text above into the daily-report delay reason.
              </p>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
