'use client';

// Estimate detail — editable.
//
// Plain English: a SharePoint-style table for one imported estimate.
// Header card across the top has Edit project info; section subheads
// have + Add line; each line has Edit + Delete on hover. All
// mutations PATCH /api/imported-estimates/:id with the full record
// (the API replaces the whole row on PATCH; partial updates would
// need a separate endpoint).
//
// Totals (Direct, O&P, Bid) are recomputed from the line array on
// every save so the header card matches the lines without the user
// having to remember to re-enter them.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  groupLinesBySection,
  importedEstimateLineCategoryLabel,
  type ImportedEstimate,
  type ImportedEstimateLine,
  type ImportedEstimateLineCategory,
  type ImportedEstimateRateType,
} from '@yge/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const CATEGORIES: ImportedEstimateLineCategory[] = [
  'LABOR',
  'EQUIPMENT_OWNED',
  'EQUIPMENT_RENTAL',
  'MATERIAL',
  'SUBCONTRACT',
  'OTHER',
];

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtMoneyCompact(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function dollarsToCents(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
function centsToDollars(c: number): string {
  return (c / 100).toFixed(2);
}

interface DraftLine {
  itemNumber: string;
  sectionName: string;
  category: ImportedEstimateLineCategory;
  costCode: string;
  description: string;
  quantity: string;
  unit: string;
  otMultiplier: string;
  unitCostDollars: string;
  notes: string;
}

function lineToDraft(l: ImportedEstimateLine, oppPercent: number): DraftLine {
  return {
    itemNumber: l.itemNumber !== undefined && l.itemNumber !== null ? String(l.itemNumber) : '',
    sectionName: l.sectionName ?? '',
    category: l.category,
    costCode: l.costCode ?? '',
    description: l.description,
    quantity: String(l.quantity ?? 0),
    unit: l.unit ?? '',
    otMultiplier: String(l.otMultiplier ?? 1),
    unitCostDollars: centsToDollars(l.unitCostCents),
    notes: l.notes ?? '',
  };
}

function draftToLine(d: DraftLine, oppPercent: number): ImportedEstimateLine {
  const quantity = Number(d.quantity) || 0;
  const otMultiplier = Number(d.otMultiplier) || 1;
  const unitCostCents = dollarsToCents(d.unitCostDollars);
  const totalCostCents = Math.round(quantity * unitCostCents * otMultiplier);
  const oppMarkupCents = Math.round(totalCostCents * oppPercent);
  const bidPriceCents = totalCostCents + oppMarkupCents;
  const itemNumber = d.itemNumber.trim() ? Number(d.itemNumber) : null;
  const out: ImportedEstimateLine = {
    category: d.category,
    description: d.description.trim(),
    quantity,
    otMultiplier,
    unitCostCents,
    totalCostCents,
    oppMarkupCents,
    bidPriceCents,
  };
  if (itemNumber !== null && Number.isFinite(itemNumber)) out.itemNumber = itemNumber;
  if (d.sectionName.trim()) out.sectionName = d.sectionName.trim();
  if (d.costCode.trim()) out.costCode = d.costCode.trim();
  if (d.unit.trim()) out.unit = d.unit.trim();
  if (d.notes.trim()) out.notes = d.notes.trim();
  return out;
}

function recomputeTotals(lines: ImportedEstimateLine[], oppPercent: number) {
  const directCostCents = lines.reduce((s, l) => s + l.totalCostCents, 0);
  const oppMarkupCents = Math.round(directCostCents * oppPercent);
  const bidPriceCents = directCostCents + oppMarkupCents;
  return { directCostCents, oppMarkupCents, bidPriceCents };
}

interface Props {
  initial: ImportedEstimate;
}

export function EstimateDetail({ initial }: Props) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<ImportedEstimate>(initial);
  const [editingProject, setEditingProject] = useState(false);
  const [editingLine, setEditingLine] = useState<{
    index: number | null; // null = new
    draft: DraftLine;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sections = useMemo(() => groupLinesBySection(estimate.lines), [estimate.lines]);

  /** Persist the full estimate to the API and update local state on success. */
  async function persist(next: ImportedEstimate) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        jobNumber: next.jobNumber,
        projectName: next.projectName,
        client: next.client,
        rateType: next.rateType,
        oppPercent: next.oppPercent,
        directCostCents: next.directCostCents,
        oppMarkupCents: next.oppMarkupCents,
        bidPriceCents: next.bidPriceCents,
        lines: next.lines,
        notes: next.notes,
        ...(next.jobId ? { jobId: next.jobId } : {}),
      };
      const res = await fetch(`${API_BASE_URL}/api/imported-estimates/${next.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Save failed (${res.status}): ${text.slice(0, 120)}`);
      }
      const json = (await res.json()) as { importedEstimate: ImportedEstimate };
      setEstimate(json.importedEstimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
      // Re-throw so callers can chain follow-up state changes only on success.
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteLine(idx: number) {
    if (!confirm('Delete this line? This cannot be undone.')) return;
    const nextLines = estimate.lines.filter((_, i) => i !== idx);
    const totals = recomputeTotals(nextLines, estimate.oppPercent);
    try {
      await persist({ ...estimate, lines: nextLines, ...totals });
    } catch {
      // error already shown via state
    }
  }

  async function saveLine(idx: number | null, draft: DraftLine) {
    const newLine = draftToLine(draft, estimate.oppPercent);
    const nextLines =
      idx === null
        ? [...estimate.lines, newLine]
        : estimate.lines.map((l, i) => (i === idx ? newLine : l));
    const totals = recomputeTotals(nextLines, estimate.oppPercent);
    try {
      await persist({ ...estimate, lines: nextLines, ...totals });
      setEditingLine(null);
    } catch {
      // keep modal open so user can retry
    }
  }

  async function saveProject(next: {
    projectName: string;
    client: string;
    rateType: ImportedEstimateRateType;
    oppPercent: number;
    notes: string;
  }) {
    const totals = recomputeTotals(estimate.lines, next.oppPercent);
    // Re-mark each line's opp/bid against the new oppPercent so existing
    // line values stay consistent with the new markup.
    const nextLines = estimate.lines.map((l) => {
      const opp = Math.round(l.totalCostCents * next.oppPercent);
      return {
        ...l,
        oppMarkupCents: opp,
        bidPriceCents: l.totalCostCents + opp,
      };
    });
    try {
      await persist({
        ...estimate,
        projectName: next.projectName,
        client: next.client || undefined,
        rateType: next.rateType,
        oppPercent: next.oppPercent,
        notes: next.notes || undefined,
        lines: nextLines,
        ...totals,
      });
      setEditingProject(false);
    } catch {
      // keep modal open
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/imported-estimates" className="text-blue-700 hover:underline">
            ← All imported estimates
          </Link>
          {estimate.jobId && (
            <Link href={`/jobs/${estimate.jobId}`} className="text-blue-700 hover:underline">
              View linked Job →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingProject(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Edit project info
          </button>
        </div>
      </div>

      {/* Project header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-yge-blue-500">{estimate.projectName}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Job {estimate.jobNumber} · {estimate.client ?? 'Client TBD'} · {estimate.rateType}
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {saving && (
        <div className="mb-3 rounded border border-blue-300 bg-blue-50 p-2 text-xs text-blue-900">
          Saving…
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Direct cost" value={fmtMoneyCompact(estimate.directCostCents)} />
        <Stat
          label={`O&P markup (${(estimate.oppPercent * 100).toFixed(0)}%)`}
          value={fmtMoneyCompact(estimate.oppMarkupCents)}
        />
        <Stat label="Bid price" value={fmtMoneyCompact(estimate.bidPriceCents)} primary />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 pb-2">
        <h2 className="text-sm font-semibold text-gray-900">
          {estimate.lines.length} line{estimate.lines.length === 1 ? '' : 's'}
        </h2>
        <button
          type="button"
          onClick={() =>
            setEditingLine({
              index: null,
              draft: {
                itemNumber: '',
                sectionName: sections.length > 0 ? sections[sections.length - 1]!.sectionName : '',
                category: 'LABOR',
                costCode: '',
                description: '',
                quantity: '0',
                unit: '',
                otMultiplier: '1',
                unitCostDollars: '',
                notes: '',
              },
            })
          }
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + Add line
        </button>
      </div>

      {sections.map((sec) => {
        const sectionDirect = sec.lines.reduce((s, l) => s + l.totalCostCents, 0);
        const sectionBid = sec.lines.reduce((s, l) => s + l.bidPriceCents, 0);
        return (
          <div key={sec.sectionName} className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                {sec.sectionName}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>
                  Direct {fmtMoneyCompact(sectionDirect)} · Bid{' '}
                  {fmtMoneyCompact(sectionBid)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEditingLine({
                      index: null,
                      draft: {
                        itemNumber: '',
                        sectionName: sec.sectionName,
                        category: 'LABOR',
                        costCode: '',
                        description: '',
                        quantity: '0',
                        unit: '',
                        otMultiplier: '1',
                        unitCostDollars: '',
                        notes: '',
                      },
                    })
                  }
                  className="text-blue-700 hover:underline"
                >
                  + Add
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Category</th>
                    <th className="px-2 py-1.5">Code</th>
                    <th className="px-2 py-1.5">Description</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                    <th className="px-2 py-1.5">Unit</th>
                    <th className="px-2 py-1.5 text-right">Unit cost</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                    <th className="px-2 py-1.5 text-right">Bid</th>
                    <th className="px-2 py-1.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sec.lines.map((l) => {
                    // We need the original index in the flat lines[] array
                    // for delete/edit, since `sec.lines` is a filtered view.
                    const flatIdx = estimate.lines.indexOf(l);
                    return (
                      <tr key={flatIdx} className="group hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-xs text-gray-500">{l.itemNumber ?? '—'}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {importedEstimateLineCategoryLabel(l.category)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{l.costCode ?? '—'}</td>
                        <td className="px-2 py-1.5">
                          {l.description}
                          {l.notes && (
                            <div className="text-[11px] italic text-gray-500">{l.notes}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">{l.quantity}</td>
                        <td className="px-2 py-1.5 text-xs text-gray-500">{l.unit ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {fmtMoney(l.unitCostCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {fmtMoney(l.totalCostCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold">
                          {fmtMoney(l.bidPriceCents)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingLine({
                                index: flatIdx,
                                draft: lineToDraft(l, estimate.oppPercent),
                              })
                            }
                            className="text-xs text-gray-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                          >
                            Edit
                          </button>
                          <span className="px-1 text-gray-300 opacity-0 group-hover:opacity-100">·</span>
                          <button
                            type="button"
                            onClick={() => deleteLine(flatIdx)}
                            className="text-xs text-red-700 opacity-0 transition group-hover:opacity-100 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {editingProject && (
        <ProjectModal
          estimate={estimate}
          onClose={() => setEditingProject(false)}
          onSave={saveProject}
        />
      )}
      {editingLine && (
        <LineModal
          initial={editingLine.draft}
          onClose={() => setEditingLine(null)}
          onSave={(draft) => saveLine(editingLine.index, draft)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div
      className={`rounded-lg border ${primary ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'} p-3`}
    >
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${primary ? 'text-blue-900' : 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  );
}

function ProjectModal({
  estimate,
  onClose,
  onSave,
}: {
  estimate: ImportedEstimate;
  onClose: () => void;
  onSave: (next: {
    projectName: string;
    client: string;
    rateType: ImportedEstimateRateType;
    oppPercent: number;
    notes: string;
  }) => Promise<void>;
}) {
  const [projectName, setProjectName] = useState(estimate.projectName);
  const [client, setClient] = useState(estimate.client ?? '');
  const [rateType, setRateType] = useState<ImportedEstimateRateType>(estimate.rateType);
  const [oppPercentStr, setOppPercentStr] = useState(
    (estimate.oppPercent * 100).toFixed(0),
  );
  const [notes, setNotes] = useState(estimate.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!projectName.trim()) {
      setErr('Project name is required.');
      return;
    }
    const opp = Number(oppPercentStr) / 100;
    if (!Number.isFinite(opp) || opp < 0) {
      setErr('O&P percent must be a non-negative number.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        projectName: projectName.trim(),
        client: client.trim(),
        rateType,
        oppPercent: opp,
        notes,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit project info</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        {err && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {err}
          </div>
        )}
        <div className="space-y-3">
          <Field label="Project name">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoFocus
            />
          </Field>
          <Field label="Client">
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate type">
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value as ImportedEstimateRateType)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="PW">PW (Public Works)</option>
                <option value="Private">Private</option>
              </select>
            </Field>
            <Field label="O&P %">
              <input
                type="number"
                step="0.1"
                value={oppPercentStr}
                onChange={(e) => setOppPercentStr(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineModal({
  initial,
  onClose,
  onSave,
}: {
  initial: DraftLine;
  onClose: () => void;
  onSave: (draft: DraftLine) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!draft.description.trim()) {
      setErr('Description is required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial.description ? 'Edit line' : 'New line'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        {err && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {err}
          </div>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Item #">
              <input
                value={draft.itemNumber}
                onChange={(e) => setDraft({ ...draft, itemNumber: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as ImportedEstimateLineCategory })
                }
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {importedEstimateLineCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Section">
            <input
              value={draft.sectionName}
              onChange={(e) => setDraft({ ...draft, sectionName: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. MOBILIZATION, TRAFFIC CONTROL"
            />
          </Field>
          <Field label="Cost code">
            <input
              value={draft.costCode}
              onChange={(e) => setDraft({ ...draft, costCode: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </Field>
          <Field label="Description">
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                step="0.01"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Unit">
              <input
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="hr"
              />
            </Field>
            <Field label="OT mult">
              <input
                type="number"
                step="0.1"
                value={draft.otMultiplier}
                onChange={(e) => setDraft({ ...draft, otMultiplier: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Unit cost ($)">
            <input
              type="number"
              step="0.01"
              value={draft.unitCostDollars}
              onChange={(e) => setDraft({ ...draft, unitCostDollars: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
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
