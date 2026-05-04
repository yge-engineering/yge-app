'use client';

// Tool editor — client island for /tools/[id]. Inline PATCH-on-blur for the
// metadata fields, plus the same dispatch controls used on the list page.

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  categoryLabel,
  fullName,
  toolStatusLabel,
  type Employee,
  type Tool,
  type ToolCategory,
  type ToolStatus,
} from '@yge/shared';
import { ToolDispatchControls } from './tool-dispatch-controls';

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

const STATUS_OPTIONS: ToolStatus[] = [
  'IN_YARD',
  'IN_SHOP',
  'OUT_FOR_REPAIR',
  'LOST',
  'RETIRED',
];

interface Props {
  initial: Tool;
  employees: Employee[];
  apiBaseUrl: string;
}

export function ToolEditor({ initial, employees, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [tool, setTool] = useState<Tool>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(tool.name);
  const [make, setMake] = useState(tool.make ?? '');
  const [model, setModel] = useState(tool.model ?? '');
  const [serialNumber, setSerialNumber] = useState(tool.serialNumber ?? '');
  const [assetTag, setAssetTag] = useState(tool.assetTag ?? '');
  const [notes, setNotes] = useState(tool.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/tools/${tool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('toolEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { tool: Tool };
      setTool(json.tool);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('toolEditor.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function saveBasics() {
    void patch({
      name: name.trim() || tool.name,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      assetTag: assetTag.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const assignee = tool.assignedToEmployeeId
    ? employees.find((e) => e.id === tool.assignedToEmployeeId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yge-blue-500">{tool.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {categoryLabel(tool.category)} &middot; {toolStatusLabel(tool.status)}
            {assignee && (
              <>
                {t('toolEditor.heldBy', { name: fullName(assignee) })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={tool.status}
            onChange={(e) => void patch({ status: e.target.value as ToolStatus })}
            disabled={tool.status === 'ASSIGNED'}
            className="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {toolStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('toolEditor.saving')}</span>}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          {t('toolEditor.dispatchHeader')}
        </h2>
        <ToolDispatchControls tool={tool} employees={employees.filter((e) => e.status === 'ACTIVE')} apiBaseUrl={apiBaseUrl} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('toolEditor.lblName')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('toolEditor.lblCategory')}>
          <select
            value={tool.category}
            onChange={(e) => void patch({ category: e.target.value as ToolCategory })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('toolEditor.lblMake')}>
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('toolEditor.lblModel')}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('toolEditor.lblSerial')}>
          <input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('toolEditor.lblAssetTag')}>
          <input
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <section>
        <Field label={t('toolEditor.lblNotes')}>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>
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
