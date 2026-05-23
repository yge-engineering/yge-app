'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AppShell } from '../../../components';
import type { DepreciationMethod, FixedAsset, FixedAssetCategory } from '@yge/shared';
import { fixedAssetCategoryLabel } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const CATEGORIES: FixedAssetCategory[] = [
  'HEAVY_EQUIPMENT',
  'VEHICLE',
  'TRAILER',
  'SHOP_TOOLS',
  'COMPUTER',
  'FURNITURE',
  'BUILDING',
  'LAND_IMPROVEMENT',
  'OTHER',
];
const METHODS: DepreciationMethod[] = [
  'STRAIGHT_LINE',
  'MACRS_5YR',
  'MACRS_7YR',
  'SECTION_179',
  'BONUS_DEPRECIATION',
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewFixedAssetPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FixedAssetCategory>('HEAVY_EQUIPMENT');
  const [vendorName, setVendorName] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [acquiredCost, setAcquiredCost] = useState('');
  const [salvageValue, setSalvageValue] = useState('0');
  const [acquiredOn, setAcquiredOn] = useState(todayIso());
  const [placedInServiceOn, setPlacedInServiceOn] = useState(todayIso());
  const [usefulLifeYears, setUsefulLifeYears] = useState('7');
  const [method, setMethod] = useState<DepreciationMethod>('MACRS_5YR');
  const [bonusPercentage, setBonusPercentage] = useState('60');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const cost = Math.round(Number(acquiredCost) * 100);
    if (!cost || cost <= 0) {
      setError('Acquired cost must be positive.');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      category,
      acquiredCostCents: cost,
      salvageValueCents: Math.round(Number(salvageValue || '0') * 100),
      acquiredOn,
      placedInServiceOn,
      usefulLifeYears: parseInt(usefulLifeYears, 10) || 7,
      method,
      bonusPercentage: (parseInt(bonusPercentage || '60', 10) || 60) / 100,
    };
    if (vendorName.trim()) body.vendorName = vendorName.trim();
    if (equipmentId.trim()) body.equipmentId = equipmentId.trim();
    if (notes.trim()) body.notes = notes.trim();
    try {
      const res = await postJson<{ asset: FixedAsset }>('/api/fixed-assets', body);
      router.push(`/fixed-assets/${res.asset.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-8">
        <div className="mb-6">
          <Link href="/fixed-assets" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to assets
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-yge-blue-500">New fixed asset</h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cat 320 Excavator (2026)"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FixedAssetCategory)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{fixedAssetCategoryLabel(c)}</option>
                ))}
              </select>
            </Field>
            <Field label="Linked equipment id (optional)">
              <input
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                placeholder="eq-…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </Field>
          </div>
          <Field label="Vendor (optional)">
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Acquired cost ($)">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={acquiredCost}
                onChange={(e) => setAcquiredCost(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Salvage value ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={salvageValue}
                onChange={(e) => setSalvageValue(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Acquired on">
              <input
                required
                type="date"
                value={acquiredOn}
                onChange={(e) => setAcquiredOn(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Placed in service on">
              <input
                required
                type="date"
                value={placedInServiceOn}
                onChange={(e) => setPlacedInServiceOn(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Useful life (yr)">
              <input
                type="number"
                min="1"
                max="40"
                value={usefulLifeYears}
                onChange={(e) => setUsefulLifeYears(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as DepreciationMethod)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Bonus % (if bonus)">
              <input
                type="number"
                min="0"
                max="100"
                value={bonusPercentage}
                onChange={(e) => setBonusPercentage(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create asset'}
            </button>
            <Link href="/fixed-assets" className="text-sm text-gray-600 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </AppShell>
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
