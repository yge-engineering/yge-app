// SWPPP / BMP inspection editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  bmpStatusLabel,
  swpppTriggerLabel,
  type BmpCheck,
  type BmpStatus,
  type SwpppInspection,
  type SwpppInspectionTrigger,
} from '@yge/shared';

const TRIGGERS: SwpppInspectionTrigger[] = [
  'WEEKLY',
  'PRE_STORM',
  'DURING_STORM',
  'POST_STORM',
  'NON_STORM_DISCHARGE',
  'OTHER',
];
const BMP_STATUSES: BmpStatus[] = [
  'OK',
  'MAINTENANCE_NEEDED',
  'FAILED',
  'NOT_INSTALLED',
  'NOT_APPLICABLE',
];

interface FormState {
  jobId: string;
  inspectedOn: string;
  trigger: SwpppInspectionTrigger;
  inspectorName: string;
  inspectorCertification: string;
  rainForecast: boolean;
  forecastPrecipInches: string;
  qualifyingRainEvent: boolean;
  observedPrecipInches: string;
  dischargeOccurred: boolean;
  dischargeDescription: string;
  notes: string;
  finalizedOn: string;
  bmpChecks: BmpCheck[];
}

function defaults(s?: SwpppInspection): FormState {
  return {
    jobId: s?.jobId ?? '',
    inspectedOn: s?.inspectedOn ?? new Date().toISOString().slice(0, 10),
    trigger: s?.trigger ?? 'WEEKLY',
    inspectorName: s?.inspectorName ?? 'Ryan D. Young',
    inspectorCertification: s?.inspectorCertification ?? '',
    rainForecast: s?.rainForecast ?? false,
    forecastPrecipInches:
      s?.forecastPrecipHundredths != null ? (s.forecastPrecipHundredths / 100).toFixed(2) : '',
    qualifyingRainEvent: s?.qualifyingRainEvent ?? false,
    observedPrecipInches:
      s?.observedPrecipHundredths != null ? (s.observedPrecipHundredths / 100).toFixed(2) : '',
    dischargeOccurred: s?.dischargeOccurred ?? false,
    dischargeDescription: s?.dischargeDescription ?? '',
    notes: s?.notes ?? '',
    finalizedOn: s?.finalizedOn ?? '',
    bmpChecks: s?.bmpChecks ?? [],
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function SwpppInspectionEditor({
  mode,
  inspection,
}: {
  mode: 'create' | 'edit';
  inspection?: SwpppInspection;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(inspection));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addBmp() {
    setField('bmpChecks', [
      ...form.bmpChecks,
      { bmpCode: '', bmpName: '', status: 'OK' },
    ]);
  }

  function updateBmp(i: number, patch: Partial<BmpCheck>) {
    setField(
      'bmpChecks',
      form.bmpChecks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    );
  }

  function removeBmp(i: number) {
    setField(
      'bmpChecks',
      form.bmpChecks.filter((_, idx) => idx !== i),
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const precipHundredths = (s: string) => {
      if (s.trim().length === 0) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? Math.round(n * 100) : undefined;
    };

    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      inspectedOn: form.inspectedOn,
      trigger: form.trigger,
      inspectorName: form.inspectorName.trim(),
      inspectorCertification: trim(form.inspectorCertification),
      rainForecast: form.rainForecast,
      forecastPrecipHundredths: precipHundredths(form.forecastPrecipInches),
      qualifyingRainEvent: form.qualifyingRainEvent,
      observedPrecipHundredths: precipHundredths(form.observedPrecipInches),
      dischargeOccurred: form.dischargeOccurred,
      dischargeDescription: trim(form.dischargeDescription),
      notes: trim(form.notes),
      finalizedOn: trim(form.finalizedOn),
      bmpChecks: form.bmpChecks
        .filter((b) => b.bmpCode.trim().length > 0 || b.bmpName.trim().length > 0)
        .map((b) => ({
          ...b,
          bmpCode: b.bmpCode.trim(),
          bmpName: b.bmpName.trim(),
          location: b.location?.trim() || undefined,
          deficiency: b.deficiency?.trim() || undefined,
          correctiveAction: b.correctiveAction?.trim() || undefined,
          correctedOn: b.correctedOn?.trim() || undefined,
        })),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/swppp-inspections`
          : `${apiBaseUrl()}/api/swppp-inspections/${inspection!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { inspection: SwpppInspection };
      if (mode === 'create') {
        router.push(`/swppp/${json.inspection.id}`);
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

      <Section title={t('swppp.secInspection')}>
        <Field label={t('swppp.lblJobId')} required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder={t('swppp.phJobId')}
            required
          />
        </Field>
        <Field label={t('swppp.lblInspectedOn')} required>
          <input
            type="date"
            className={inputCls}
            value={form.inspectedOn}
            onChange={(e) => setField('inspectedOn', e.target.value)}
            required
          />
        </Field>
        <Field label={t('swppp.lblTrigger')}>
          <select
            className={inputCls}
            value={form.trigger}
            onChange={(e) => setField('trigger', e.target.value as SwpppInspectionTrigger)}
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {swpppTriggerLabel(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('swppp.lblFinalizedOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.finalizedOn}
            onChange={(e) => setField('finalizedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('swppp.secInspector')}>
        <Field label={t('swppp.lblInspectorName')} required>
          <input
            className={inputCls}
            value={form.inspectorName}
            onChange={(e) => setField('inspectorName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('swppp.lblInspectorCert')}>
          <input
            className={inputCls}
            value={form.inspectorCertification}
            onChange={(e) => setField('inspectorCertification', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('swppp.secWeather')}>
        <Field label={t('swppp.lblRainForecast')}>
          <Checkbox
            checked={form.rainForecast}
            onChange={(b) => setField('rainForecast', b)}
            label={t('swppp.cbRainForecast')}
          />
        </Field>
        <Field label={t('swppp.lblForecastPrecip')}>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.forecastPrecipInches}
            onChange={(e) => setField('forecastPrecipInches', e.target.value)}
          />
        </Field>
        <Field label={t('swppp.lblQualifying')}>
          <Checkbox
            checked={form.qualifyingRainEvent}
            onChange={(b) => setField('qualifyingRainEvent', b)}
            label={t('swppp.cbQualifying')}
          />
        </Field>
        <Field label={t('swppp.lblObservedPrecip')}>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.observedPrecipInches}
            onChange={(e) => setField('observedPrecipInches', e.target.value)}
          />
        </Field>
        <Field label={t('swppp.lblDischarge')}>
          <Checkbox
            checked={form.dischargeOccurred}
            onChange={(b) => setField('dischargeOccurred', b)}
            label={t('swppp.cbDischarge')}
          />
        </Field>
        <Field label={t('swppp.lblDischargeDesc')} full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.dischargeDescription}
            onChange={(e) => setField('dischargeDescription', e.target.value)}
          />
        </Field>
      </Section>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('swppp.bmpHeader', { count: form.bmpChecks.length })}
          </h2>
          <button
            type="button"
            onClick={addBmp}
            className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
          >
            {t('swppp.addBmp')}
          </button>
        </div>
        {form.bmpChecks.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            {t('swppp.bmpEmpty')}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {form.bmpChecks.map((b, i) => (
              <div
                key={i}
                className={`rounded border p-3 ${
                  b.status === 'FAILED'
                    ? 'border-red-300 bg-red-50'
                    : b.status === 'MAINTENANCE_NEEDED'
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpCode')}</label>
                    <input
                      className={inputCls}
                      value={b.bmpCode}
                      onChange={(e) => updateBmp(i, { bmpCode: e.target.value })}
                      placeholder={t('swppp.phBmpCode')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpName')}</label>
                    <input
                      className={inputCls}
                      value={b.bmpName}
                      onChange={(e) => updateBmp(i, { bmpName: e.target.value })}
                      placeholder={t('swppp.phBmpName')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpStatus')}</label>
                    <select
                      className={inputCls}
                      value={b.status}
                      onChange={(e) =>
                        updateBmp(i, { status: e.target.value as BmpStatus })
                      }
                    >
                      {BMP_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {bmpStatusLabel(st)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpLocation')}</label>
                    <input
                      className={inputCls}
                      value={b.location ?? ''}
                      onChange={(e) => updateBmp(i, { location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpCorrectedOn')}</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={b.correctedOn ?? ''}
                      onChange={(e) => updateBmp(i, { correctedOn: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">{t('swppp.lblBmpDeficiency')}</label>
                    <textarea
                      className={`${inputCls} min-h-[40px]`}
                      value={b.deficiency ?? ''}
                      onChange={(e) => updateBmp(i, { deficiency: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">
                      {t('swppp.lblBmpAction')}
                    </label>
                    <textarea
                      className={`${inputCls} min-h-[40px]`}
                      value={b.correctiveAction ?? ''}
                      onChange={(e) => updateBmp(i, { correctiveAction: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeBmp(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('swppp.removeBmp')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Section title={t('swppp.secNotes')}>
        <Field label={t('swppp.lblNotes')} full>
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
          {saving ? t('swppp.busy') : mode === 'create' ? t('swppp.create') : t('swppp.save')}
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
