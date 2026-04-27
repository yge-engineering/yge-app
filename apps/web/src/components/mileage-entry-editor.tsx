// Mileage entry editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  formatUSD,
  mileagePurposeLabel,
  reimbursementCents,
  type MileageEntry,
  type MileagePurpose,
} from '@yge/shared';

const PURPOSES: MileagePurpose[] = [
  'JOBSITE_TRAVEL',
  'INTER_JOBSITE',
  'BID_WALK',
  'AGENCY_MEETING',
  'SUPPLY_RUN',
  'EQUIPMENT_TRANSPORT',
  'OFFICE_ERRAND',
  'TRAINING',
  'OTHER',
];

interface FormState {
  employeeId: string;
  employeeName: string;
  tripDate: string;
  equipmentId: string;
  vehicleDescription: string;
  isPersonalVehicle: boolean;
  odometerStart: string;
  odometerEnd: string;
  businessMiles: string;
  purpose: MileagePurpose;
  jobId: string;
  description: string;
  irsRateCentsPerMile: string;
  reimbursed: boolean;
  reimbursedOn: string;
  notes: string;
}

function defaults(e?: MileageEntry): FormState {
  return {
    employeeId: e?.employeeId ?? '',
    employeeName: e?.employeeName ?? '',
    tripDate: e?.tripDate ?? new Date().toISOString().slice(0, 10),
    equipmentId: e?.equipmentId ?? '',
    vehicleDescription: e?.vehicleDescription ?? '',
    isPersonalVehicle: e?.isPersonalVehicle ?? false,
    odometerStart: e?.odometerStart != null ? String(e.odometerStart) : '',
    odometerEnd: e?.odometerEnd != null ? String(e.odometerEnd) : '',
    businessMiles: e?.businessMiles != null ? String(e.businessMiles) : '',
    purpose: e?.purpose ?? 'JOBSITE_TRAVEL',
    jobId: e?.jobId ?? '',
    description: e?.description ?? '',
    irsRateCentsPerMile: e?.irsRateCentsPerMile != null ? String(e.irsRateCentsPerMile) : '67',
    reimbursed: e?.reimbursed ?? false,
    reimbursedOn: e?.reimbursedOn ?? '',
    notes: e?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function MileageEntryEditor({
  mode,
  entry,
}: {
  mode: 'create' | 'edit';
  entry?: MileageEntry;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(entry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // Auto-calc business miles when both odometer fields are filled.
  const odoStartNum = Number(form.odometerStart);
  const odoEndNum = Number(form.odometerEnd);
  const odoMilesValid =
    Number.isFinite(odoStartNum) &&
    Number.isFinite(odoEndNum) &&
    form.odometerStart.trim().length > 0 &&
    form.odometerEnd.trim().length > 0 &&
    odoEndNum >= odoStartNum;
  const computedMiles = odoMilesValid ? odoEndNum - odoStartNum : null;

  // Live reimbursement preview.
  const previewMiles = Number(form.businessMiles) || 0;
  const previewRate = Number(form.irsRateCentsPerMile) || 0;
  const previewReimburse = reimbursementCents({
    businessMiles: previewMiles,
    irsRateCentsPerMile: previewRate,
    isPersonalVehicle: form.isPersonalVehicle,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const num = (s: string) => {
      if (s.trim().length === 0) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const body: Record<string, unknown> = {
      employeeId: form.employeeId.trim(),
      employeeName: form.employeeName.trim(),
      tripDate: form.tripDate,
      equipmentId: trim(form.equipmentId),
      vehicleDescription: form.vehicleDescription.trim(),
      isPersonalVehicle: form.isPersonalVehicle,
      odometerStart: num(form.odometerStart),
      odometerEnd: num(form.odometerEnd),
      businessMiles: Number(form.businessMiles) || 0,
      purpose: form.purpose,
      jobId: trim(form.jobId),
      description: trim(form.description),
      irsRateCentsPerMile: num(form.irsRateCentsPerMile),
      reimbursed: form.reimbursed,
      reimbursedOn: trim(form.reimbursedOn),
      notes: trim(form.notes),
    };
    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/mileage`
          : `${apiBaseUrl()}/api/mileage/${entry!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { entry: MileageEntry };
      if (mode === 'create') {
        router.push(`/mileage/${json.entry.id}`);
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

      {form.isPersonalVehicle && previewReimburse > 0 && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <strong>Reimbursement preview:</strong> {previewMiles.toFixed(1)} mi ×{' '}
          {previewRate}¢ = {formatUSD(previewReimburse)}
        </div>
      )}

      <Section title="Trip">
        <Field label="Employee ID" required>
          <input
            className={inputCls}
            value={form.employeeId}
            onChange={(e) => setField('employeeId', e.target.value)}
            placeholder="emp-xxxxxxxx"
            required
          />
        </Field>
        <Field label="Employee name" required>
          <input
            className={inputCls}
            value={form.employeeName}
            onChange={(e) => setField('employeeName', e.target.value)}
            required
          />
        </Field>
        <Field label="Trip date" required>
          <input
            type="date"
            className={inputCls}
            value={form.tripDate}
            onChange={(e) => setField('tripDate', e.target.value)}
            required
          />
        </Field>
        <Field label="Purpose">
          <select
            className={inputCls}
            value={form.purpose}
            onChange={(e) => setField('purpose', e.target.value as MileagePurpose)}
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {mileagePurposeLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job ID">
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
          />
        </Field>
        <Field label="Description / route" full>
          <input
            className={inputCls}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Yard → Sulphur Springs Rd Sta 12+50"
          />
        </Field>
      </Section>

      <Section title="Vehicle">
        <Field label="Vehicle description" required>
          <input
            className={inputCls}
            value={form.vehicleDescription}
            onChange={(e) => setField('vehicleDescription', e.target.value)}
            placeholder="2022 Ford F-250 (YGE-04)"
            required
          />
        </Field>
        <Field label="Equipment ID (company)">
          <input
            className={inputCls}
            value={form.equipmentId}
            onChange={(e) => setField('equipmentId', e.target.value)}
            placeholder="eq-xxxxxxxx"
          />
        </Field>
        <Field label="Personal vehicle?">
          <Checkbox
            checked={form.isPersonalVehicle}
            onChange={(b) => setField('isPersonalVehicle', b)}
            label="Reimbursable at IRS rate"
          />
        </Field>
      </Section>

      <Section title="Miles">
        <Field label="Odometer start">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.odometerStart}
            onChange={(e) => setField('odometerStart', e.target.value)}
          />
        </Field>
        <Field label="Odometer end">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.odometerEnd}
            onChange={(e) => setField('odometerEnd', e.target.value)}
          />
        </Field>
        <Field label="Business miles" required>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              className={inputCls}
              value={form.businessMiles}
              onChange={(e) => setField('businessMiles', e.target.value)}
              required
            />
            {computedMiles != null && computedMiles !== Number(form.businessMiles) && (
              <button
                type="button"
                className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
                onClick={() => setField('businessMiles', computedMiles.toFixed(1))}
              >
                Use {computedMiles.toFixed(1)}
              </button>
            )}
          </div>
        </Field>
        <Field label="IRS rate (¢/mile)">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.irsRateCentsPerMile}
            onChange={(e) => setField('irsRateCentsPerMile', e.target.value)}
            placeholder="67"
          />
        </Field>
      </Section>

      <Section title="Reimbursement">
        <Field label="Reimbursed">
          <Checkbox
            checked={form.reimbursed}
            onChange={(b) => setField('reimbursed', b)}
            label="Already paid out to employee"
          />
        </Field>
        <Field label="Reimbursed on">
          <input
            type="date"
            className={inputCls}
            value={form.reimbursedOn}
            onChange={(e) => setField('reimbursedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes" full>
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
          {saving ? 'Saving…' : mode === 'create' ? 'Log mileage' : 'Save changes'}
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
