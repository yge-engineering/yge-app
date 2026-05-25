'use client';

// Two-phase upload UI for the master-rates Excel workbook:
//   1. drag-drop the .xlsx → fires dryRun=1 → preview parsed counts
//      + any warnings
//   2. estimator clicks "Import now" → fires the same endpoint
//      without dryRun → API writes Cost codes / Labor / Equipment /
//      Rental / Material rows + returns a final summary

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  apiBaseUrl: string;
}

interface ImportCounts {
  parsed: number;
  written: number;
}

interface ImportSummary {
  costCodes: ImportCounts;
  laborRates: ImportCounts;
  equipmentRates: ImportCounts;
  equipmentRental: ImportCounts;
  materials: ImportCounts;
  warnings: string[];
  dryRun: boolean;
}

interface ImportResponse {
  summary: ImportSummary;
  sample?: Record<string, unknown>;
}

export function RateImportClient({ apiBaseUrl }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [committed, setCommitted] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'idle' | 'preview' | 'commit'>('idle');
  const [drag, setDrag] = useState(false);

  async function postFile(f: File, dryRun: boolean): Promise<ImportResponse> {
    const form = new FormData();
    form.append('file', f);
    const url = `${apiBaseUrl}/api/admin/excel-import/master-tables${dryRun ? '?dryRun=1' : ''}`;
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as ImportResponse;
  }

  async function handleFiles(files: FileList | null) {
    setError(null);
    setPreview(null);
    setCommitted(null);
    if (!files || files.length === 0) return;
    const f = files[0]!;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError(`Need an .xlsx file — got ${f.name}.`);
      return;
    }
    setFile(f);
    setBusy('preview');
    try {
      const r = await postFile(f, true);
      setPreview(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy('idle');
    }
  }

  async function handleCommit() {
    if (!file) return;
    setError(null);
    setBusy('commit');
    try {
      const r = await postFile(file, false);
      setCommitted(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy('idle');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    void handleFiles(e.dataTransfer.files);
  }

  function row(label: string, c: ImportCounts) {
    const isCommit = committed != null;
    const n = isCommit ? c.written : c.parsed;
    const tone = n === 0 ? 'text-gray-400' : 'text-gray-900';
    return (
      <tr>
        <td className="py-1 pr-3 text-sm text-gray-700">{label}</td>
        <td className={`py-1 pr-3 text-right text-sm font-semibold tabular-nums ${tone}`}>
          {n.toLocaleString()}
        </td>
      </tr>
    );
  }

  const active = committed ?? preview;

  return (
    <div className="mt-6 space-y-5">
      {!committed && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition ${drag ? 'border-yge-blue-500 bg-yge-blue-50' : 'border-gray-300 bg-white'}`}
        >
          <p className="text-sm text-gray-700">
            Drop your master-rates <code className="rounded bg-gray-100 px-1 font-mono text-xs">.xlsx</code> here
            {file && <span className="ml-1 text-gray-500">· current: {file.name}</span>}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            or pick a file:&nbsp;
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => void handleFiles(e.target.files)}
              disabled={busy !== 'idle'}
              className="text-xs"
            />
          </p>
          {busy === 'preview' && (
            <p className="mt-2 text-xs text-yge-blue-700">Parsing workbook…</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {active && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {committed ? 'Import committed' : 'Preview (dry run)'}
            </h3>
            {!committed && (
              <button
                onClick={handleCommit}
                disabled={busy !== 'idle' || !file}
                className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'commit' ? 'Importing…' : 'Import now'}
              </button>
            )}
          </div>
          <table className="mt-3 w-full">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1 pr-3 text-left font-medium">Sheet</th>
                <th className="py-1 pr-3 text-right font-medium">
                  {committed ? 'Rows written' : 'Rows parsed'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {row('Cost codes', active.summary.costCodes)}
              {row('Labor rates', active.summary.laborRates)}
              {row('Equipment rates', active.summary.equipmentRates)}
              {row('Equipment rental', active.summary.equipmentRental)}
              {row('Materials', active.summary.materials)}
            </tbody>
          </table>
          {active.summary.warnings.length > 0 && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">
                Warnings ({active.summary.warnings.length}):
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {active.summary.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {active.summary.warnings.length > 10 && (
                <p className="mt-1 italic">
                  …and {active.summary.warnings.length - 10} more.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {committed && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            ✓ Rate book loaded — every future AI takeoff will use YGE numbers.
          </p>
          <p className="mt-2 text-xs">
            Review the loaded rates:&nbsp;
            <Link href="/labor-rates" className="underline">labor rates</Link>
            {' · '}
            <Link href="/equipment-rates" className="underline">equipment rates</Link>
            {' · '}
            <Link href="/rates" className="underline">all rates</Link>.
          </p>
          <p className="mt-2 text-xs">
            <Link href="/plans-to-estimate" className="underline">
              Run a new vision takeoff to see the YGE book in action →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
