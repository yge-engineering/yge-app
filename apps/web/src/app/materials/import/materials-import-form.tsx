'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Summary {
  total: number; created: number; updated: number; skipped: number;
  errors: Array<{ row: number; reason: string }>; dryRun: boolean;
}

export function MaterialsImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(dryRun: boolean) {
    if (!file) { setError('Pick a CSV file first'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `${apiBaseUrl()}/api/materials/import-csv${dryRun ? '?dryRun=1' : ''}`;
      const res = await fetch(url, { method: 'POST', body: fd });
      const body = (await res.json()) as { summary?: Summary; error?: string };
      if (!res.ok) { setError(body.error ?? `Failed (${res.status})`); return; }
      setResult(body.summary ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 rounded-md border border-gray-200 bg-blue-50 p-3 text-xs text-blue-900">
        <strong>CSV format:</strong> first row must be header <code>code,name,unit,unitCost</code>. Optional: category, notes.
        <br />
        <a href={`${apiBaseUrl()}/api/materials/export.csv`} download className="text-yge-blue-700 hover:underline">
          Download current materials as a starter CSV →
        </a>
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 block text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void submit(true)} disabled={busy || !file} className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50">
          {busy ? 'Working…' : 'Dry-run preview'}
        </button>
        <button type="button" onClick={() => void submit(false)} disabled={busy || !file} className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
          {busy ? 'Working…' : 'Import (writes)'}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p>
      )}
      {result && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
          <div className="font-semibold">{result.dryRun ? 'Dry-run preview' : 'Import complete'}</div>
          <div>{result.total} rows · {result.created} created · {result.updated} updated · {result.skipped} skipped</div>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-red-700">
              {result.errors.slice(0, 10).map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
