'use client';

// /materials/new — minimal create form. After save the editor lets you
// log opening stock + record movements + edit reorder/cost.

import { useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  materialCategoryLabel,
  type Material,
  type MaterialCategory,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator, useLocale } from '../../../lib/use-translator';

const CATEGORIES: MaterialCategory[] = [
  'AGGREGATE',
  'ASPHALT',
  'CONCRETE',
  'REBAR',
  'PIPE',
  'FITTING',
  'GEOTEXTILE',
  'EROSION_CONTROL',
  'SIGN',
  'PAINT',
  'WELDING',
  'FUEL',
  'LUBRICANT',
  'FASTENER',
  'SAFETY',
  'ELECTRICAL',
  'CONSUMABLE',
  'OTHER',
];

export default function NewMaterialPage() {
  const t = useTranslator();
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('OTHER');
  const [unit, setUnit] = useState('EA');
  const [sku, setSku] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [unitCostDollars, setUnitCostDollars] = useState('');
  const [location, setLocation] = useState('');
  const [preferredVendor, setPreferredVendor] = useState('');
  const [openingQty, setOpeningQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) {
      setError(t('newMaterial.errName'));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category,
        unit: unit.trim() || 'EA',
        ...(sku.trim() ? { sku: sku.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(preferredVendor.trim() ? { preferredVendor: preferredVendor.trim() } : {}),
      };
      if (reorderPoint.trim()) body.reorderPoint = Number(reorderPoint);
      if (unitCostDollars.trim()) {
        body.unitCostCents = Math.round(Number(unitCostDollars) * 100);
      }
      if (openingQty.trim()) body.quantityOnHand = Number(openingQty);

      const res = await postJson<{ material: Material }>('/api/materials', body);
      router.push(`/materials/${res.material.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(t('newMaterial.errHttp', { msg: err.message, status: err.status }));
      else if (err instanceof Error) setError(err.message);
      else setError(t('newMaterial.errUnknown'));
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/materials" className="text-sm text-yge-blue-500 hover:underline">
          {t('newMaterial.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newMaterial.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('newMaterial.lblName')}>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('newMaterial.phName')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('newMaterial.lblCategory')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MaterialCategory)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {materialCategoryLabel(c, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('newMaterial.lblUnit')}>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newMaterial.lblSku')}>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('newMaterial.lblOpeningQty')}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingQty}
              onChange={(e) => setOpeningQty(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newMaterial.lblReorderPoint')}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newMaterial.lblUnitCost')}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitCostDollars}
              onChange={(e) => setUnitCostDollars(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('newMaterial.lblLocation')}>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('newMaterial.phLocation')}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newMaterial.lblVendor')}>
            <input
              value={preferredVendor}
              onChange={(e) => setPreferredVendor(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? t('newMaterial.busy') : t('newMaterial.action')}
          </button>
          <Link href="/materials" className="text-sm text-gray-600 hover:underline">
            {t('newMaterial.cancel')}
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
