'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  SwpppInspectionCreate,
  SwpppInspectionTrigger,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const TRIGGERS: SwpppInspectionTrigger[] = [
  'WEEKLY',
  'PRE_STORM',
  'DURING_STORM',
  'POST_STORM',
  'NON_STORM_DISCHARGE',
  'OTHER',
];

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
const selectClass = 'rounded border border-gray-300 px-2 py-1.5 text-sm bg-white w-full';
const textareaClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';

export function SwpppInspectionNewForm() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [inspectedOn, setInspectedOn] = useState(new Date().toISOString().slice(0, 10));
  const [trigger, setTrigger] = useState<SwpppInspectionTrigger>('WEEKLY');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorCertification, setInspectorCertification] = useState('');
  const [rainForecast, setRainForecast] = useState(false);
  const [forecastPrecipInches, setForecastPrecipInches] = useState('');
  const [qualifyingRainEvent, setQualifyingRainEvent] = useState(false);
  const [observedPrecipInches, setObservedPrecipInches] = useState('');
  const [dischargeOccurred, setDischargeOccurred] = useState(false);
  const [dischargeDescription, setDischargeDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function inchesToHundredths(s: string): number | undefined {
    if (!s.trim()) return undefined;
    const n = Number.parseFloat(s);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!jobId.trim()) { setError('Job id is required.'); return; }
      if (!inspectorName.trim()) { setError('Inspector name is required.'); return; }
      const payload: SwpppInspectionCreate = {
        jobId: jobId.trim(),
        inspectedOn,
        trigger,
        inspectorName: inspectorName.trim(),
        inspectorCertification: inspectorCertification.trim() || undefined,
        rainForecast,
        forecastPrecipHundredths: inchesToHundredths(forecastPrecipInches),
        qualifyingRainEvent,
        observedPrecipHundredths: inchesToHundredths(observedPrecipInches),
        dischargeOccurred,
        dischargeDescription: dischargeDescription.trim() || undefined,
        bmpChecks: [],
        notes: notes.trim() || undefined,
      };
      const res = await fetch(`${apiBaseUrl()}/api/swppp-inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      router.push('/swppp-inspections');
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
          <Field label="Inspected on">
            <input type="date" value={inspectedOn} onChange={(e) => setInspectedOn(e.target.value)}
              className={inputClass} />
          </Field>
          <Field label="Trigger">
            <select value={trigger} onChange={(e) => setTrigger(e.target.value as SwpppInspectionTrigger)}
              className={selectClass}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Inspector name (required)">
            <input type="text" value={inspectorName} onChange={(e) => setInspectorName(e.target.value)}
              className={inputClass} placeholder="QSP/QSD inspector" />
          </Field>
          <Field label="Inspector QSP/QSD cert #">
            <input type="text" value={inspectorCertification}
              onChange={(e) => setInspectorCertification(e.target.value)}
              className={inputClass + ' font-mono'} />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Storm conditions</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rainForecast}
              onChange={(e) => setRainForecast(e.target.checked)} />
            Rain forecast at time of inspection
          </label>
          <Field label="Forecast precip (inches)">
            <input type="text" inputMode="decimal" value={forecastPrecipInches}
              onChange={(e) => setForecastPrecipInches(e.target.value)} className={inputClass}
              placeholder="0.50" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={qualifyingRainEvent}
              onChange={(e) => setQualifyingRainEvent(e.target.checked)} />
            Qualifying rain event observed (≥ 0.5")
          </label>
          <Field label="Observed precip (inches)">
            <input type="text" inputMode="decimal" value={observedPrecipInches}
              onChange={(e) => setObservedPrecipInches(e.target.value)} className={inputClass}
              placeholder="0.73" />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Discharge</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dischargeOccurred}
            onChange={(e) => setDischargeOccurred(e.target.checked)} />
          Discharge from the site occurred
        </label>
        {dischargeOccurred && (
          <div className="mt-3">
            <Field label="Discharge description">
              <textarea value={dischargeDescription}
                onChange={(e) => setDischargeDescription(e.target.value)}
                rows={3} className={textareaClass}
                placeholder="Where, what kind of water, what BMP let it through, what corrective action." />
            </Field>
          </div>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <Field label="Site notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className={textareaClass}
            placeholder="Anything else — adjacent water, sediment piles uncovered, etc." />
        </Field>
      </section>

      <button type="button" disabled={busy} onClick={save}
        className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
        {busy ? 'Saving…' : 'Save inspection'}
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
