// DIR prevailing wage rate editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  classificationLabel,
  dollarsToCents,
  formatUSD,
  type DirClassification,
  type DirRate,
} from '@yge/shared';

const CLASSIFICATIONS: DirClassification[] = [
  'OPERATING_ENGINEER_GROUP_1',
  'OPERATING_ENGINEER_GROUP_2',
  'OPERATING_ENGINEER_GROUP_3',
  'OPERATING_ENGINEER_GROUP_4',
  'OPERATING_ENGINEER_GROUP_5',
  'TEAMSTER_GROUP_1',
  'TEAMSTER_GROUP_2',
  'LABORER_GROUP_1',
  'LABORER_GROUP_2',
  'LABORER_GROUP_3',
  'CARPENTER',
  'CEMENT_MASON',
  'IRONWORKER',
  'OTHER',
];

interface FormState {
  classification: DirClassification;
  county: string;
  effectiveDate: string;
  expiresOn: string;
  basicHourly: string;
  healthAndWelfare: string;
  pension: string;
  vacationHoliday: string;
  training: string;
  otherFringe: string;
  notes: string;
  sourceUrl: string;
}

function defaults(r?: DirRate): FormState {
  return {
    classification: r?.classification ?? 'OPERATING_ENGINEER_GROUP_1',
    county: r?.county ?? 'Shasta',
    effectiveDate: r?.effectiveDate ?? new Date().toISOString().slice(0, 10),
    expiresOn: r?.expiresOn ?? '',
    basicHourly: r?.basicHourlyCents != null ? (r.basicHourlyCents / 100).toFixed(2) : '',
    healthAndWelfare:
      r?.healthAndWelfareCents != null ? (r.healthAndWelfareCents / 100).toFixed(2) : '',
    pension: r?.pensionCents != null ? (r.pensionCents / 100).toFixed(2) : '',
    vacationHoliday:
      r?.vacationHolidayCents != null ? (r.vacationHolidayCents / 100).toFixed(2) : '',
    training: r?.trainingCents != null ? (r.trainingCents / 100).toFixed(2) : '',
    otherFringe:
      r?.otherFringeCents != null ? (r.otherFringeCents / 100).toFixed(2) : '',
    notes: r?.notes ?? '',
    sourceUrl: r?.sourceUrl ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function DirRateEditor({
  mode,
  rate,
}: {
  mode: 'create' | 'edit';
  rate?: DirRate;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(rate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // Live total preview.
  const cents = (s: string) =>
    s.trim().length === 0 ? 0 : dollarsToCents(Number(s) || 0);
  const previewBasic = cents(form.basicHourly);
  const previewFringe =
    cents(form.healthAndWelfare) +
    cents(form.pension) +
    cents(form.vacationHoliday) +
    cents(form.training) +
    cents(form.otherFringe);
  const previewTotal = previewBasic + previewFringe;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      classification: form.classification,
      county: form.county.trim(),
      effectiveDate: form.effectiveDate,
      expiresOn: trim(form.expiresOn),
      basicHourlyCents: cents(form.basicHourly),
      healthAndWelfareCents: cents(form.healthAndWelfare),
      pensionCents: cents(form.pension),
      vacationHolidayCents: cents(form.vacationHoliday),
      trainingCents: cents(form.training),
      otherFringeCents: cents(form.otherFringe),
      notes: trim(form.notes),
      sourceUrl: trim(form.sourceUrl),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/dir-rates`
          : `${apiBaseUrl()}/api/dir-rates/${rate!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { rate: DirRate };
      if (mode === 'create') {
        router.push(`/dir-rates/${json.rate.id}`);
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

      <Section title="Classification + dates">
        <Field label="Classification" required>
          <select
            className={inputCls}
            value={form.classification}
            onChange={(e) => setField('classification', e.target.value as DirClassification)}
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {classificationLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="County" required>
          <input
            className={inputCls}
            value={form.county}
            onChange={(e) => setField('county', e.target.value)}
            placeholder="Shasta or STATEWIDE"
            required
          />
        </Field>
        <Field label="Effective date" required>
          <input
            type="date"
            className={inputCls}
            value={form.effectiveDate}
            onChange={(e) => setField('effectiveDate', e.target.value)}
            required
          />
        </Field>
        <Field label="Expires on">
          <input
            type="date"
            className={inputCls}
            value={form.expiresOn}
            onChange={(e) => setField('expiresOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Wage components ($/hr)">
        <Field label="Basic hourly" required>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.basicHourly}
            onChange={(e) => setField('basicHourly', e.target.value)}
            required
          />
        </Field>
        <Field label="Health & welfare">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.healthAndWelfare}
            onChange={(e) => setField('healthAndWelfare', e.target.value)}
          />
        </Field>
        <Field label="Pension">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.pension}
            onChange={(e) => setField('pension', e.target.value)}
          />
        </Field>
        <Field label="Vacation / holiday">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.vacationHoliday}
            onChange={(e) => setField('vacationHoliday', e.target.value)}
          />
        </Field>
        <Field label="Training">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.training}
            onChange={(e) => setField('training', e.target.value)}
          />
        </Field>
        <Field label="Other fringe">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.otherFringe}
            onChange={(e) => setField('otherFringe', e.target.value)}
          />
        </Field>
      </Section>

      <div className="rounded-lg border border-gray-200 bg-blue-50 p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-600">Basic</div>
            <div className="text-lg font-bold text-yge-blue-500">
              {formatUSD(previewBasic)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-600">Total Fringe</div>
            <div className="text-lg font-bold text-yge-blue-500">
              {formatUSD(previewFringe)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-600">Total Prevailing</div>
            <div className="text-lg font-bold text-yge-blue-500">
              {formatUSD(previewTotal)}
            </div>
          </div>
        </div>
      </div>

      <Section title="Source + notes">
        <Field label="DIR source URL" full>
          <input
            className={inputCls}
            value={form.sourceUrl}
            onChange={(e) => setField('sourceUrl', e.target.value)}
            placeholder="https://www.dir.ca.gov/..."
          />
        </Field>
        <Field label="Notes (overtime, doubletime, shift differential)" full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
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
          {saving ? 'Saving…' : mode === 'create' ? 'Create rate' : 'Save changes'}
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
