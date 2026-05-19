'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  WeatherLogCreate,
  WeatherCondition,
  WeatherImpact,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const CONDITIONS: WeatherCondition[] = [
  'CLEAR', 'PARTLY_CLOUDY', 'OVERCAST', 'LIGHT_RAIN', 'HEAVY_RAIN',
  'SNOW', 'FOG', 'WIND', 'EXTREME_HEAT', 'EXTREME_COLD', 'OTHER',
];
const IMPACTS: WeatherImpact[] = ['NONE', 'PARTIAL', 'STOPPED'];

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
const numInputClass = 'w-24 rounded border border-gray-300 px-2 py-1.5 text-right text-sm font-mono';
const selectClass = 'rounded border border-gray-300 px-2 py-1.5 text-sm bg-white w-full';
const textareaClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';

export function WeatherLogNewForm() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [observedOn, setObservedOn] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [highF, setHighF] = useState('');
  const [lowF, setLowF] = useState('');
  const [precipInches, setPrecipInches] = useState('');
  const [windMph, setWindMph] = useState('');
  const [gustMph, setGustMph] = useState('');
  const [primaryCondition, setPrimaryCondition] = useState<WeatherCondition>('CLEAR');
  const [notes, setNotes] = useState('');
  const [impact, setImpact] = useState<WeatherImpact>('NONE');
  const [lostHours, setLostHours] = useState('');
  const [heatProcedures, setHeatProcedures] = useState(false);
  const [highHeatProcedures, setHighHeatProcedures] = useState(false);
  const [recordedByName, setRecordedByName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function intOrUndef(s: string): number | undefined {
    if (!s.trim()) return undefined;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  function floatOrZero(s: string): number {
    if (!s.trim()) return 0;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!jobId.trim()) { setError('Job id is required.'); return; }
      const precipH = precipInches.trim()
        ? Math.round(Number.parseFloat(precipInches) * 100)
        : undefined;
      const payload: WeatherLogCreate = {
        jobId: jobId.trim(),
        observedOn,
        location: location.trim() || undefined,
        highF: intOrUndef(highF),
        lowF: intOrUndef(lowF),
        precipHundredthsInch: precipH,
        windMph: intOrUndef(windMph),
        gustMph: intOrUndef(gustMph),
        primaryCondition,
        notes: notes.trim() || undefined,
        impact,
        lostHours: floatOrZero(lostHours),
        heatProceduresActivated: heatProcedures || highHeatProcedures,
        highHeatProceduresActivated: highHeatProcedures,
        recordedByName: recordedByName.trim() || undefined,
        source: 'MANUAL',
      };
      const res = await fetch(`${apiBaseUrl()}/api/weather-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      router.push('/weather-logs');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job ID (required)">
            <input type="text" value={jobId} onChange={(e) => setJobId(e.target.value)}
              className={inputClass + ' font-mono'} placeholder="job-2026-04-..." />
          </Field>
          <Field label="Observed on">
            <input type="date" value={observedOn} onChange={(e) => setObservedOn(e.target.value)}
              className={inputClass} />
          </Field>
          <Field label="Location (optional)">
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              className={inputClass} placeholder="Sta. 5+00, jobsite, etc." />
          </Field>
          <Field label="Recorded by">
            <input type="text" value={recordedByName} onChange={(e) => setRecordedByName(e.target.value)}
              className={inputClass} placeholder="Foreman name" />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Conditions</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Primary condition">
            <select value={primaryCondition}
              onChange={(e) => setPrimaryCondition(e.target.value as WeatherCondition)}
              className={selectClass}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="High °F">
            <input type="text" inputMode="numeric" value={highF}
              onChange={(e) => setHighF(e.target.value)} className={numInputClass} />
          </Field>
          <Field label="Low °F">
            <input type="text" inputMode="numeric" value={lowF}
              onChange={(e) => setLowF(e.target.value)} className={numInputClass} />
          </Field>
          <Field label="Precip (in.)">
            <input type="text" inputMode="decimal" value={precipInches}
              onChange={(e) => setPrecipInches(e.target.value)} className={numInputClass}
              placeholder="0.00" />
          </Field>
          <Field label="Wind mph">
            <input type="text" inputMode="numeric" value={windMph}
              onChange={(e) => setWindMph(e.target.value)} className={numInputClass} />
          </Field>
          <Field label="Gust mph">
            <input type="text" inputMode="numeric" value={gustMph}
              onChange={(e) => setGustMph(e.target.value)} className={numInputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Impact + heat-illness</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Impact">
            <select value={impact} onChange={(e) => setImpact(e.target.value as WeatherImpact)}
              className={selectClass}>
              {IMPACTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Lost hours">
            <input type="text" inputMode="decimal" value={lostHours}
              onChange={(e) => setLostHours(e.target.value)} className={numInputClass}
              placeholder="0" />
          </Field>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={heatProcedures || highHeatProcedures}
                onChange={(e) => setHeatProcedures(e.target.checked)} />
              §3395 heat procedures activated (≥ 80°F)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={highHeatProcedures}
                onChange={(e) => setHighHeatProcedures(e.target.checked)} />
              HIGH-HEAT procedures activated (≥ 95°F)
            </label>
          </div>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <Field label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className={textareaClass}
            placeholder="Free-form — sky, ground, AM vs PM split, crews affected." />
        </Field>
      </section>

      <button type="button" disabled={busy} onClick={save}
        className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
        {busy ? 'Saving…' : 'Save log entry'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
