'use client';

// /equipment/new — add a new unit. Minimal create form; the unit detail
// page handles assignment, maintenance log, and full editing.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  equipmentCategoryLabel,
  type Equipment,
  type EquipmentCategory,
  type EquipmentUsageMetric,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const CATEGORIES: EquipmentCategory[] = [
  'TRUCK',
  'TRAILER',
  'DOZER',
  'EXCAVATOR',
  'LOADER',
  'BACKHOE',
  'GRADER',
  'ROLLER',
  'PAVER',
  'COMPACTOR_LARGE',
  'WATER_TRUCK',
  'SWEEPER',
  'GENERATOR_LARGE',
  'SUPPORT',
  'OTHER',
];

interface FormState {
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  year: string;
  vin: string;
  serialNumber: string;
  assetTag: string;
  plateNumber: string;
  usageMetric: EquipmentUsageMetric;
  currentUsage: string;
  serviceIntervalUsage: string;
  notes: string;
}

const INITIAL: FormState = {
  name: '',
  category: 'TRUCK',
  make: '',
  model: '',
  year: '',
  vin: '',
  serialNumber: '',
  assetTag: '',
  plateNumber: '',
  usageMetric: 'MILES',
  currentUsage: '',
  serviceIntervalUsage: '',
  notes: '',
};

export default function NewEquipmentPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Default the usage metric based on category — trucks/trailers = miles,
  // everything else = hours. The user can still override.
  function setCategory(c: EquipmentCategory) {
    setForm((prev) => ({
      ...prev,
      category: c,
      usageMetric:
        c === 'TRUCK' || c === 'TRAILER' || c === 'WATER_TRUCK' || c === 'SWEEPER'
          ? 'MILES'
          : 'HOURS',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length === 0) {
      setError('Unit name is required.');
      return;
    }
    let yearNum: number | undefined;
    if (form.year.trim().length > 0) {
      const n = Number(form.year);
      if (!Number.isFinite(n) || n < 1900 || n > 2100) {
        setError('Year must be a 4-digit number.');
        return;
      }
      yearNum = n;
    }
    let currentUsageNum = 0;
    if (form.currentUsage.trim().length > 0) {
      const n = Number(form.currentUsage);
      if (!Number.isFinite(n) || n < 0) {
        setError('Current usage must be a non-negative number.');
        return;
      }
      currentUsageNum = Math.round(n);
    }
    let intervalNum: number | undefined;
    if (form.serviceIntervalUsage.trim().length > 0) {
      const n = Number(form.serviceIntervalUsage);
      if (!Number.isFinite(n) || n <= 0) {
        setError('Service interval must be a positive number.');
        return;
      }
      intervalNum = Math.round(n);
    }

    const body = {
      name: form.name.trim(),
      category: form.category,
      usageMetric: form.usageMetric,
      currentUsage: currentUsageNum,
      ...(form.make.trim() ? { make: form.make.trim() } : {}),
      ...(form.model.trim() ? { model: form.model.trim() } : {}),
      ...(yearNum !== undefined ? { year: yearNum } : {}),
      ...(form.vin.trim() ? { vin: form.vin.trim() } : {}),
      ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
      ...(form.assetTag.trim() ? { assetTag: form.assetTag.trim() } : {}),
      ...(form.plateNumber.trim() ? { plateNumber: form.plateNumber.trim() } : {}),
      ...(intervalNum !== undefined ? { serviceIntervalUsage: intervalNum } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    setSaving(true);
    try {
      const res = await postJson<{ equipment: Equipment }>('/api/equipment', body);
      router.push(`/equipment/${res.equipment.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/equipment" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to equipment
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Add equipment / vehicle</h1>
      <p className="mt-2 text-gray-700">
        Adds a unit to inventory. After save you can log maintenance entries
        and assign the unit to a job.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Unit name *">
          <input
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='e.g. "F-450 Service Truck", "Cat D6T"'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {equipmentCategoryLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Usage metric">
            <select
              value={form.usageMetric}
              onChange={(e) =>
                update('usageMetric', e.target.value as EquipmentUsageMetric)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="MILES">Miles (odometer)</option>
              <option value="HOURS">Hours (engine)</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Make">
            <input
              value={form.make}
              onChange={(e) => update('make', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Model">
            <input
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Year">
            <input
              value={form.year}
              onChange={(e) => update('year', e.target.value)}
              placeholder="2022"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="VIN (trucks / trailers)">
            <input
              value={form.vin}
              onChange={(e) => update('vin', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Serial / PIN (heavy iron)">
            <input
              value={form.serialNumber}
              onChange={(e) => update('serialNumber', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Plate number">
            <input
              value={form.plateNumber}
              onChange={(e) => update('plateNumber', e.target.value)}
              placeholder="CA 1ABC234"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Asset tag">
            <input
              value={form.assetTag}
              onChange={(e) => update('assetTag', e.target.value)}
              placeholder="YGE-12"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Current ${form.usageMetric === 'MILES' ? 'odometer (mi)' : 'engine hours'}`}
          >
            <input
              type="number"
              min="0"
              value={form.currentUsage}
              onChange={(e) => update('currentUsage', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field
            label={`Service interval (${form.usageMetric === 'MILES' ? 'miles' : 'hours'})`}
          >
            <input
              type="number"
              min="1"
              value={form.serviceIntervalUsage}
              onChange={(e) => update('serviceIntervalUsage', e.target.value)}
              placeholder={form.usageMetric === 'MILES' ? '5000' : '250'}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save unit'}
          </button>
          <Link href="/equipment" className="text-sm text-gray-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
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
