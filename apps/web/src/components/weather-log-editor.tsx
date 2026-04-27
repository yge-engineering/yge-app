// Weather log editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  HEAT_THRESHOLD_F,
  HIGH_HEAT_THRESHOLD_F,
  shouldActivateHeatProcedures,
  shouldActivateHighHeatProcedures,
  weatherConditionLabel,
  weatherImpactLabel,
  type WeatherCondition,
  type WeatherImpact,
  type WeatherLog,
} from '@yge/shared';

const CONDITIONS: WeatherCondition[] = [
  'CLEAR',
  'PARTLY_CLOUDY',
  'OVERCAST',
  'LIGHT_RAIN',
  'HEAVY_RAIN',
  'SNOW',
  'FOG',
  'WIND',
  'EXTREME_HEAT',
  'EXTREME_COLD',
  'OTHER',
];
const IMPACTS: WeatherImpact[] = ['NONE', 'PARTIAL', 'STOPPED'];

interface FormState {
  jobId: string;
  observedOn: string;
  location: string;
  highF: string;
  lowF: string;
  precipInches: string;
  windMph: string;
  gustMph: string;
  primaryCondition: WeatherCondition;
  notes: string;
  impact: WeatherImpact;
  lostHours: string;
  heatProceduresActivated: boolean;
  highHeatProceduresActivated: boolean;
  recordedByName: string;
  source: string;
}

function defaults(w?: WeatherLog): FormState {
  return {
    jobId: w?.jobId ?? '',
    observedOn: w?.observedOn ?? new Date().toISOString().slice(0, 10),
    location: w?.location ?? '',
    highF: w?.highF != null ? String(w.highF) : '',
    lowF: w?.lowF != null ? String(w.lowF) : '',
    precipInches:
      w?.precipHundredthsInch != null ? (w.precipHundredthsInch / 100).toFixed(2) : '',
    windMph: w?.windMph != null ? String(w.windMph) : '',
    gustMph: w?.gustMph != null ? String(w.gustMph) : '',
    primaryCondition: w?.primaryCondition ?? 'CLEAR',
    notes: w?.notes ?? '',
    impact: w?.impact ?? 'NONE',
    lostHours: String(w?.lostHours ?? 0),
    heatProceduresActivated: w?.heatProceduresActivated ?? false,
    highHeatProceduresActivated: w?.highHeatProceduresActivated ?? false,
    recordedByName: w?.recordedByName ?? 'Ryan D. Young',
    source: w?.source ?? 'MANUAL',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function WeatherLogEditor({
  mode,
  log,
}: {
  mode: 'create' | 'edit';
  log?: WeatherLog;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(log));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const highInt = parseInt(form.highF, 10);
  const previewHighF = Number.isFinite(highInt) ? highInt : null;
  const heatTrigger = shouldActivateHeatProcedures({ highF: previewHighF ?? undefined });
  const highHeatTrigger = shouldActivateHighHeatProcedures({ highF: previewHighF ?? undefined });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const numOrUndef = (s: string) => {
      if (s.trim().length === 0) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? Math.round(n) : undefined;
    };

    const precip = (() => {
      if (form.precipInches.trim().length === 0) return undefined;
      const n = Number(form.precipInches);
      if (!Number.isFinite(n)) return undefined;
      return Math.round(n * 100);
    })();

    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      observedOn: form.observedOn,
      location: trim(form.location),
      highF: numOrUndef(form.highF),
      lowF: numOrUndef(form.lowF),
      precipHundredthsInch: precip,
      windMph: numOrUndef(form.windMph),
      gustMph: numOrUndef(form.gustMph),
      primaryCondition: form.primaryCondition,
      notes: trim(form.notes),
      impact: form.impact,
      lostHours: Number(form.lostHours || 0),
      heatProceduresActivated: form.heatProceduresActivated,
      highHeatProceduresActivated: form.highHeatProceduresActivated,
      recordedByName: trim(form.recordedByName),
      source: trim(form.source),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/weather-logs`
          : `${apiBaseUrl()}/api/weather-logs/${log!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { log: WeatherLog };
      if (mode === 'create') {
        router.push(`/weather/${json.log.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Section title="Day + job">
        <Field label="Job ID" required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
            required
          />
        </Field>
        <Field label="Observed on" required>
          <input
            type="date"
            className={inputCls}
            value={form.observedOn}
            onChange={(e) => setField('observedOn', e.target.value)}
            required
          />
        </Field>
        <Field label="Location (optional)">
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
          />
        </Field>
        <Field label="Recorded by">
          <input
            className={inputCls}
            value={form.recordedByName}
            onChange={(e) => setField('recordedByName', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Observations">
        <Field label="High temp (°F)">
          <input
            type="number"
            className={inputCls}
            value={form.highF}
            onChange={(e) => setField('highF', e.target.value)}
          />
        </Field>
        <Field label="Low temp (°F)">
          <input
            type="number"
            className={inputCls}
            value={form.lowF}
            onChange={(e) => setField('lowF', e.target.value)}
          />
        </Field>
        <Field label="Precipitation (inches)">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.precipInches}
            onChange={(e) => setField('precipInches', e.target.value)}
          />
        </Field>
        <Field label="Sustained wind (mph)">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.windMph}
            onChange={(e) => setField('windMph', e.target.value)}
          />
        </Field>
        <Field label="Peak gust (mph)">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.gustMph}
            onChange={(e) => setField('gustMph', e.target.value)}
          />
        </Field>
        <Field label="Primary condition">
          <select
            className={inputCls}
            value={form.primaryCondition}
            onChange={(e) => setField('primaryCondition', e.target.value as WeatherCondition)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {weatherConditionLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {(heatTrigger || highHeatTrigger) && (
        <div
          className={`rounded border p-3 text-sm ${
            highHeatTrigger
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-yellow-300 bg-yellow-50 text-yellow-900'
          }`}
        >
          <strong>§3395 trigger:</strong>{' '}
          {highHeatTrigger
            ? `High temp ${previewHighF}°F is at or above the ${HIGH_HEAT_THRESHOLD_F}°F HIGH-HEAT threshold — mandatory rest, observer, and pre-shift meeting required.`
            : `High temp ${previewHighF}°F is at or above the ${HEAT_THRESHOLD_F}°F base threshold — water, shade, training, and acclimatization required.`}
        </div>
      )}

      <Section title="§3395 procedures activated">
        <Field label="Heat procedures">
          <Checkbox
            checked={form.heatProceduresActivated}
            onChange={(b) => setField('heatProceduresActivated', b)}
            label={`Activated base heat-illness procedures (≥ ${HEAT_THRESHOLD_F}°F)`}
          />
        </Field>
        <Field label="High-heat procedures">
          <Checkbox
            checked={form.highHeatProceduresActivated}
            onChange={(b) => setField('highHeatProceduresActivated', b)}
            label={`Activated HIGH-HEAT procedures (≥ ${HIGH_HEAT_THRESHOLD_F}°F)`}
          />
        </Field>
      </Section>

      <Section title="Impact">
        <Field label="Impact">
          <select
            className={inputCls}
            value={form.impact}
            onChange={(e) => setField('impact', e.target.value as WeatherImpact)}
          >
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                {weatherImpactLabel(i)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hours lost (all crews)">
          <input
            type="number"
            step="0.25"
            min="0"
            className={inputCls}
            value={form.lostHours}
            onChange={(e) => setField('lostHours', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Free-form notes" full>
          <textarea
            className={`${inputCls} min-h-[100px]`}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Log day' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-yge-blue-500 focus:ring-yge-blue-500"
      />
      {label}
    </label>
  );
}
