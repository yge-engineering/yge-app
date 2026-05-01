'use client';

// /tools/new — add a new power tool to the inventory.

import { useState } from 'react';
import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { useRouter } from 'next/navigation';
import {
  categoryLabel,
  type Tool,
  type ToolCategory,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const CATEGORIES: ToolCategory[] = [
  'IMPACT_DRIVER',
  'DRILL',
  'SAW',
  'GRINDER',
  'JACKHAMMER',
  'COMPACTOR',
  'PRESSURE_WASHER',
  'GENERATOR',
  'PUMP',
  'SURVEY',
  'METER',
  'WELDER',
  'TORCH',
  'AIR_COMPRESSOR',
  'NAIL_GUN',
  'OTHER',
];

interface FormState {
  name: string;
  category: ToolCategory;
  make: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  notes: string;
}

const INITIAL: FormState = {
  name: '',
  category: 'OTHER',
  make: '',
  model: '',
  serialNumber: '',
  assetTag: '',
  notes: '',
};

export default function NewToolPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (form.name.trim().length === 0) {
      setError('Tool name is required.');
      return;
    }

    const body = {
      name: form.name.trim(),
      category: form.category,
      ...(form.make.trim() ? { make: form.make.trim() } : {}),
      ...(form.model.trim() ? { model: form.model.trim() } : {}),
      ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
      ...(form.assetTag.trim() ? { assetTag: form.assetTag.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    setSaving(true);
    try {
      const res = await postJson<{ tool: Tool }>('/api/tools', body);
      router.push(`/tools/${res.tool.id}`);
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
    <AppShell>
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/tools" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to tools
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Add power tool</h1>
      <p className="mt-2 text-gray-700">
        Add the tool to inventory. Once saved you can dispatch it out to a
        crew member from the tool list.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Tool name *">
          <input
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='e.g. "Milwaukee 18V Impact Driver"'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as ToolCategory)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make">
            <input
              value={form.make}
              onChange={(e) => update('make', e.target.value)}
              placeholder="Milwaukee"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Model">
            <input
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="2767-20"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Serial number">
            <input
              value={form.serialNumber}
              onChange={(e) => update('serialNumber', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Asset tag">
            <input
              value={form.assetTag}
              onChange={(e) => update('assetTag', e.target.value)}
              placeholder="YGE-042"
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
            {saving ? 'Saving…' : 'Save tool'}
          </button>
          <Link href="/tools" className="text-sm text-gray-600 hover:underline">
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
