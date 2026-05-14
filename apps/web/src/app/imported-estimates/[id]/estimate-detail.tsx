'use client';

// Estimate detail — Excel-style inline editor.
//
// Plain English: every line cell is a real <input> you can click into
// and type. Tab moves to the next cell, Enter saves and stays. When
// you click out of a cell (blur) we save the whole estimate to the
// API. Totals (Total cost / O&P / Bid) are computed live and
// read-only. + Add line drops a new empty row at the bottom of a
// section. Hover any line for Delete. The "Edit project info" button
// stays as a modal for header-level fields (name, client, rate,
// O&P %).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  importedEstimateLineCategoryLabel,
  type CostCode,
  type ImportedEstimate,
  type ImportedEstimateLine,
  type ImportedEstimateLineCategory,
  type ImportedEstimateRateType,
} from '@yge/shared';

// Common construction units. Used as a typeahead suggestion list on
// the Unit column. The user can still type a custom value — datalist
// only suggests, doesn't restrict.
const COMMON_UNITS = [
  'hr', 'day', 'week', 'mo', 'year',
  'ea', 'ls', 'lf', 'sf', 'sy', 'cy',
  'ton', 'lb', 'gal', 'mi', 'km',
] as const;

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
function dollarsToCents(s: string | number): number {
  if (typeof s === 'number') return Math.round(s * 100);
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/[$,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function recomputeLine(
  line: ImportedEstimateLine,
  oppPercent: number,
): ImportedEstimateLine {
  const totalCostCents = Math.round(
    line.quantity * line.unitCostCents * line.otMultiplier,
  );
  const oppMarkupCents = Math.round(totalCostCents * oppPercent);
  const bidPriceCents = totalCostCents + oppMarkupCents;
  return { ...line, totalCostCents, oppMarkupCents, bidPriceCents };
}

function recomputeAllTotals(lines: ImportedEstimateLine[], oppPercent: number) {
  const directCostCents = lines.reduce((s, l) => s + l.totalCostCents, 0);
  const oppMarkupCents = Math.round(directCostCents * oppPercent);
  const bidPriceCents = directCostCents + oppMarkupCents;
  return { directCostCents, oppMarkupCents, bidPriceCents };
}

type SectionGroup = { sectionName: string; lines: Array<{ line: ImportedEstimateLine; idx: number }> };

function groupLinesPreservingIndex(
  lines: ImportedEstimateLine[],
): SectionGroup[] {
  const out: SectionGroup[] = [];
  let current: SectionGroup | null = null;
  lines.forEach((line, idx) => {
    const section = line.sectionName ?? '(Uncategorized)';
    if (!current || current.sectionName !== section) {
      current = { sectionName: section, lines: [] };
      out.push(current);
    }
    current.lines.push({ line, idx });
  });
  return out;
}

interface Props {
  initial: ImportedEstimate;
  costCodes: CostCode[];
}

export function EstimateDetail({ initial, costCodes }: Props) {
  const [estimate, setEstimate] = useState<ImportedEstimate>(initial);

  // Lookup helper: code (case-insensitive) -> CostCode record. Used by
  // the cost-code cell to auto-fill the description after the user
  // picks a code from the typeahead.
  const costCodeByCode = useMemo(() => {
    const map = new Map<string, CostCode>();
    for (const c of costCodes) map.set(c.code.toLowerCase(), c);
    return map;
  }, [costCodes]);
  const [editingProject, setEditingProject] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneJobNumber, setCloneJobNumber] = useState('');
  const [cloneProjectName, setCloneProjectName] = useState('');
  const [cloneClient, setCloneClient] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Generation counter — bumped after every successful save. Each row
  // resets its uncontrolled inputs to the new line value when it sees
  // a new gen. Keeps inputs from fighting in-flight server data.
  const [gen, setGen] = useState(0);

  const sections = useMemo(() => groupLinesPreservingIndex(estimate.lines), [
    estimate.lines,
  ]);

  /** Persist a new estimate snapshot, optimistically updating local
   *  state first so the UI is snappy. Reverts on save failure. */
  async function persist(next: ImportedEstimate) {
    const prev = estimate;
    setEstimate(next);
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
      // Revert on failure so the UI doesn't lie about what's saved.
      setEstimate(prev);
      setError(err instanceof Error ? err.message : 'Save failed.');
      throw err;
    } finally {
      setSaving(false);
      setGen((g) => g + 1);
    }
  }

  function applyLineChange(idx: number, patch: Partial<ImportedEstimateLine>) {
    const before = estimate.lines[idx];
    if (!before) return;
    const merged = recomputeLine({ ...before, ...patch }, estimate.oppPercent);
    // No-op short-circuit: skip the round-trip if nothing actually changed.
    if (
      JSON.stringify({ ...before, totalCostCents: 0, oppMarkupCents: 0, bidPriceCents: 0 }) ===
      JSON.stringify({ ...merged, totalCostCents: 0, oppMarkupCents: 0, bidPriceCents: 0 })
    ) {
      return;
    }
    const nextLines = estimate.lines.map((l, i) => (i === idx ? merged : l));
    const totals = recomputeAllTotals(nextLines, estimate.oppPercent);
    void persist({ ...estimate, lines: nextLines, ...totals }).catch(() => undefined);
  }

  function deleteLine(idx: number) {
    if (!confirm('Delete this line? This cannot be undone.')) return;
    const nextLines = estimate.lines.filter((_, i) => i !== idx);
    const totals = recomputeAllTotals(nextLines, estimate.oppPercent);
    void persist({ ...estimate, lines: nextLines, ...totals }).catch(() => undefined);
  }

  function addLine(sectionName: string) {
    const newLine: ImportedEstimateLine = {
      sectionName,
      category: 'LABOR',
      description: '',
      quantity: 0,
      otMultiplier: 1,
      unitCostCents: 0,
      totalCostCents: 0,
      oppMarkupCents: 0,
      bidPriceCents: 0,
    };
    // Insert at the end of the matching section so the new row shows
    // up where the user clicked. Falls back to appending at the end
    // when the section doesn't exist yet (new section being created).
    let insertAt = estimate.lines.length;
    for (let i = estimate.lines.length - 1; i >= 0; i -= 1) {
      const sec = estimate.lines[i]!.sectionName ?? '(Uncategorized)';
      if (sec === sectionName) {
        insertAt = i + 1;
        break;
      }
    }
    const nextLines = [
      ...estimate.lines.slice(0, insertAt),
      newLine,
      ...estimate.lines.slice(insertAt),
    ];
    const totals = recomputeAllTotals(nextLines, estimate.oppPercent);
    void persist({ ...estimate, lines: nextLines, ...totals }).catch(() => undefined);
  }

  function renameSection(oldName: string) {
    const next = prompt('Rename section', oldName);
    if (!next || next.trim() === oldName) return;
    const newName = next.trim();
    const nextLines = estimate.lines.map((l) =>
      (l.sectionName ?? '(Uncategorized)') === oldName
        ? { ...l, sectionName: newName }
        : l,
    );
    const totals = recomputeAllTotals(nextLines, estimate.oppPercent);
    void persist({ ...estimate, lines: nextLines, ...totals }).catch(() => undefined);
  }

  async function saveProject(next: {
    projectName: string;
    client: string;
    rateType: ImportedEstimateRateType;
    oppPercent: number;
    notes: string;
  }) {
    // When O&P percent changes, walk every line and update its
    // oppMarkupCents + bidPriceCents so the per-line bid stays
    // consistent with the new percentage.
    const nextLines = estimate.lines.map((l) => {
      const opp = Math.round(l.totalCostCents * next.oppPercent);
      return { ...l, oppMarkupCents: opp, bidPriceCents: l.totalCostCents + opp };
    });
    const totals = recomputeAllTotals(nextLines, next.oppPercent);
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


  async function performClone() {
    if (!cloneJobNumber.trim() || !cloneProjectName.trim()) {
      setCloneError('Job # and Project name are required');
      return;
    }
    setCloneBusy(true);
    setCloneError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/imported-estimates/${estimate.id}/clone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobNumber: cloneJobNumber.trim(),
          projectName: cloneProjectName.trim(),
          client: cloneClient.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { importedEstimate?: { id: string }; error?: string };
      if (!res.ok || !body.importedEstimate) {
        setCloneError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.push(`/imported-estimates/${body.importedEstimate.id}`);
    } catch (err) {
      setCloneError((err as Error).message);
    } finally {
      setCloneBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/imported-estimates" className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
            ← All imported estimates
          </Link>
          {estimate.jobId && (
            <Link href={`/jobs/${estimate.jobId}`} className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
              View linked Job →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-blue-700">Saving…</span>
          )}
          <button
            type="button"
            onClick={() => setEditingProject(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Edit project info
          </button>
          <button
            type="button"
            onClick={() => {
              setCloneJobNumber('');
              setCloneProjectName(`Copy of ${estimate.projectName}`);
              setCloneClient(estimate.client ?? '');
              setCloneError(null);
              setCloning(true);
            }}
            className="rounded-md border border-yge-blue-500 bg-white px-3 py-1.5 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-50"
            title="Create a new bid pre-filled with these lines"
          >
            Clone to new bid
          </button>
        </div>
      </div>

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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Direct cost" value={fmtMoneyCompact(estimate.directCostCents)} />
        <Stat
          label={`O&P markup (${(estimate.oppPercent * 100).toFixed(0)}%)`}
          value={fmtMoneyCompact(estimate.oppMarkupCents)}
        />
        <Stat label="Bid price" value={fmtMoneyCompact(estimate.bidPriceCents)} primary />
      </div>

      <p className="mb-2 text-xs text-gray-500">
        Click any cell to edit. Tab moves to the next cell, Enter saves. Changes save automatically.
      </p>

      {/* Master suggestion lists, referenced by every row's input. The
       *  browser handles the dropdown UI + filtering as the user types. */}
      <datalist id="cost-codes-master">
        {costCodes.map((c) => (
          <option key={c.id} value={c.code}>
            {c.description ?? ''}
          </option>
        ))}
      </datalist>
      <datalist id="units-master">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {sections.map((sec) => {
        const sectionDirect = sec.lines.reduce((s, l) => s + l.line.totalCostCents, 0);
        const sectionBid = sec.lines.reduce((s, l) => s + l.line.bidPriceCents, 0);
        return (
          <div key={sec.sectionName} className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-1">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-900">
                {sec.sectionName}
                <button
                  type="button"
                  onClick={() => renameSection(sec.sectionName)}
                  className="text-[10px] font-normal normal-case text-gray-400 hover:text-gray-700"
                >
                  rename
                </button>
              </h3>
              <button
                type="button"
                onClick={() => addLine(sec.sectionName)}
                className="text-xs text-blue-700 hover:underline"
              >
                + Add line
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-14 px-1 py-1.5">#</th>
                    <th className="w-36 px-1 py-1.5">Category</th>
                    <th className="w-36 px-1 py-1.5">Code</th>
                    <th className="px-1 py-1.5">Description</th>
                    <th className="w-20 px-1 py-1.5 text-right">Qty</th>
                    <th className="w-20 px-1 py-1.5">Unit</th>
                    <th className="w-20 px-1 py-1.5 text-right">OT</th>
                    <th className="w-28 px-1 py-1.5 text-right">Unit cost</th>
                    <th className="w-28 px-1 py-1.5 text-right">Total</th>
                    <th className="w-28 px-1 py-1.5 text-right">Bid</th>
                    <th className="w-12 px-1 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sec.lines.map(({ line, idx }) => (
                    <EditableLineRow
                      key={`${idx}-${gen}`}
                      line={line}
                      costCodeByCode={costCodeByCode}
                      onChange={(patch) => applyLineChange(idx, patch)}
                      onDelete={() => deleteLine(idx)}
                    />
                  ))}
                  {/* Section subtotal row — same column layout, money
                   *  values right-aligned in the Total + Bid columns.
                   *  Mirrors how the YGE Excel ends each section. */}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={7} className="px-2 py-1.5 text-right text-xs uppercase tracking-wide text-gray-700">
                      Subtotal
                    </td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-1 py-1.5 text-right font-mono text-xs text-gray-700">
                      {fmtMoney(sectionDirect)}
                    </td>
                    <td className="px-1 py-1.5 text-right font-mono text-xs text-gray-900">
                      {fmtMoney(sectionBid)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="mt-4">
        <button
          type="button"
          onClick={() =>
            addLine(
              sections.length > 0
                ? sections[sections.length - 1]!.sectionName
                : 'New section',
            )
          }
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + Add line
        </button>
      </div>

      {editingProject && (
        <ProjectModal
          estimate={estimate}
          onClose={() => setEditingProject(false)}
          onSave={saveProject}
        />
      )}
      {cloning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Clone to new bid</h2>
              <button
                type="button"
                onClick={() => setCloning(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-600">
              Creates a new imported estimate with all lines copied. Adjust pricing as needed.
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700">New Job #</span>
                <input
                  type="text"
                  value={cloneJobNumber}
                  onChange={(e) => setCloneJobNumber(e.target.value)}
                  placeholder="e.g. 27-001"
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700">Project name</span>
                <input
                  type="text"
                  value={cloneProjectName}
                  onChange={(e) => setCloneProjectName(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700">Client (optional)</span>
                <input
                  type="text"
                  value={cloneClient}
                  onChange={(e) => setCloneClient(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              {cloneError && (
                <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                  {cloneError}
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloning(false)}
                disabled={cloneBusy}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void performClone()}
                disabled={cloneBusy}
                className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                {cloneBusy ? 'Cloning…' : 'Create clone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Editable row -------------------------------------------------------

function EditableLineRow({
  line,
  costCodeByCode,
  onChange,
  onDelete,
}: {
  line: ImportedEstimateLine;
  costCodeByCode: Map<string, CostCode>;
  onChange: (patch: Partial<ImportedEstimateLine>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group hover:bg-gray-50">
      <CellInputNumber
        defaultValue={line.itemNumber ?? null}
        onCommit={(v) => onChange({ itemNumber: v ?? undefined })}
        align="left"
      />
      <CellSelect
        defaultValue={line.category}
        options={CATEGORIES.map((c) => ({
          value: c,
          label: importedEstimateLineCategoryLabel(c),
        }))}
        onCommit={(v) => onChange({ category: v as ImportedEstimateLineCategory })}
      />
      <CellInputCostCode
        defaultValue={line.costCode ?? ''}
        currentDescription={line.description}
        costCodeByCode={costCodeByCode}
        onCommit={(code, autoDescription) => {
          const patch: Partial<ImportedEstimateLine> = {
            costCode: code || undefined,
          };
          if (autoDescription !== undefined) patch.description = autoDescription;
          onChange(patch);
        }}
      />
      <CellInputText
        defaultValue={line.description}
        onCommit={(v) => onChange({ description: v })}
      />
      <CellInputNumber
        defaultValue={line.quantity}
        onCommit={(v) => onChange({ quantity: v ?? 0 })}
        align="right"
        step="any"
      />
      <CellInputUnit
        defaultValue={line.unit ?? ''}
        onCommit={(v) => onChange({ unit: v || undefined })}
      />
      <CellInputNumber
        defaultValue={line.otMultiplier}
        onCommit={(v) => onChange({ otMultiplier: v ?? 1 })}
        align="right"
        step="any"
      />
      <CellInputDollars
        defaultCents={line.unitCostCents}
        onCommit={(cents) => onChange({ unitCostCents: cents })}
      />
      <td className="px-1 py-1 text-right font-mono text-xs text-gray-600">
        {fmtMoney(line.totalCostCents)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-xs font-semibold text-gray-900">
        {fmtMoney(line.bidPriceCents)}
      </td>
      <td className="px-1 py-1 text-right">
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete line"
          className="text-xs text-red-700 opacity-0 transition group-hover:opacity-100 hover:underline"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

// ---- Cell primitives ----------------------------------------------------
//
// These are uncontrolled inputs (use defaultValue + onBlur/onKeyDown).
// The parent passes a fresh `key` whenever it needs to reset the value
// (e.g. after a server save) so React mounts a fresh input.

function CellInputText({
  defaultValue,
  onCommit,
  mono,
}: {
  defaultValue: string;
  onCommit: (v: string) => void;
  mono?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <td className="px-0.5 py-0.5">
      <input
        ref={ref}
        defaultValue={defaultValue}
        onBlur={(e) => {
          const v = e.target.value;
          if (v !== defaultValue) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            if (ref.current) ref.current.value = defaultValue;
            ref.current?.blur();
          }
        }}
        className={`w-full bg-transparent px-1 py-1 text-sm focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      />
    </td>
  );
}

function CellInputCostCode({
  defaultValue,
  currentDescription,
  costCodeByCode,
  onCommit,
}: {
  defaultValue: string;
  currentDescription: string;
  costCodeByCode: Map<string, CostCode>;
  onCommit: (code: string, autoDescription: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Capture the description that came in alongside the previous code.
  // We use it to detect "untouched" descriptions — only those get
  // overwritten when the user picks a new code.
  const prevAutoDescRef = useRef<string | null>(
    (() => {
      const c = costCodeByCode.get(defaultValue.toLowerCase());
      return c?.description ?? null;
    })(),
  );

  function commit(rawValue: string) {
    const code = rawValue.trim();
    if (code === defaultValue) return;
    const found = costCodeByCode.get(code.toLowerCase());
    if (found && found.description) {
      // Only auto-fill description when:
      //  - it's empty, or
      //  - it matches the description that came from the previous
      //    cost code (= user hadn't typed a custom one)
      const desc = currentDescription.trim();
      const prev = prevAutoDescRef.current;
      const shouldAuto = !desc || (prev && desc === prev);
      prevAutoDescRef.current = found.description;
      onCommit(code, shouldAuto ? found.description : undefined);
    } else {
      // Code not in master list — save it as-is, no auto-fill.
      prevAutoDescRef.current = null;
      onCommit(code, undefined);
    }
  }

  return (
    <td className="px-0.5 py-0.5">
      <input
        ref={ref}
        list="cost-codes-master"
        defaultValue={defaultValue}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            if (ref.current) ref.current.value = defaultValue;
            ref.current?.blur();
          }
        }}
        className="w-full bg-transparent px-1 py-1 font-mono text-xs focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500"
        placeholder="LAB-…"
      />
    </td>
  );
}

function CellInputUnit({
  defaultValue,
  onCommit,
}: {
  defaultValue: string;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <td className="px-0.5 py-0.5">
      <input
        ref={ref}
        list="units-master"
        defaultValue={defaultValue}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== defaultValue) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            if (ref.current) ref.current.value = defaultValue;
            ref.current?.blur();
          }
        }}
        className="w-full bg-transparent px-1 py-1 text-xs focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500"
        placeholder="hr"
      />
    </td>
  );
}

function CellInputNumber({
  defaultValue,
  onCommit,
  align,
  step,
}: {
  defaultValue: number | null;
  onCommit: (v: number | null) => void;
  align?: 'left' | 'right';
  step?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const initial = defaultValue === null ? '' : String(defaultValue);
  return (
    <td className="px-0.5 py-0.5">
      <input
        ref={ref}
        type="number"
        step={step ?? '1'}
        defaultValue={initial}
        onBlur={(e) => {
          const raw = e.target.value;
          if (raw === initial) return;
          if (raw === '') return onCommit(null);
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            if (ref.current) ref.current.value = initial;
            ref.current?.blur();
          }
        }}
        className={`w-full bg-transparent px-1 py-1 font-mono text-xs focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500 ${
          align === 'right' ? 'text-right' : ''
        }`}
      />
    </td>
  );
}

function CellInputDollars({
  defaultCents,
  onCommit,
}: {
  defaultCents: number;
  onCommit: (cents: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const initial = (defaultCents / 100).toFixed(2);
  return (
    <td className="px-0.5 py-0.5">
      <input
        ref={ref}
        type="number"
        step="0.01"
        defaultValue={initial}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const cents = dollarsToCents(raw);
          if (cents !== defaultCents) onCommit(cents);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            if (ref.current) ref.current.value = initial;
            ref.current?.blur();
          }
        }}
        className="w-full bg-transparent px-1 py-1 text-right font-mono text-xs focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500"
      />
    </td>
  );
}

function CellSelect<T extends string>({
  defaultValue,
  options,
  onCommit,
}: {
  defaultValue: T;
  options: Array<{ value: T; label: string }>;
  onCommit: (v: T) => void;
}) {
  const [value, setValue] = useState<T>(defaultValue);
  // Reset to defaultValue when key (gen) changes via parent.
  useEffect(() => setValue(defaultValue), [defaultValue]);
  return (
    <td className="px-0.5 py-0.5">
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as T;
          setValue(next);
          if (next !== defaultValue) onCommit(next);
        }}
        className="w-full bg-transparent px-1 py-1 text-xs focus:bg-white focus:outline focus:outline-2 focus:outline-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </td>
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

// ---- Project info modal --------------------------------------------------

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
