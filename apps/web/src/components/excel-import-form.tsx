'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ExcelImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(dryRun: boolean) {
    if (!file) {
      setError('Pick a file first');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `${apiBaseUrl()}/api/admin/excel-import/master-tables${dryRun ? '?dryRun=1' : ''}`;
      const res = await fetch(url, { method: 'POST', body: fd });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Master tables (Wave A1)
      </h2>
      <p className="mb-3 text-xs text-gray-600">
        Reads <code>Cost_Codes</code>, <code>Labor_Rates</code>,{' '}
        <code>Equipment_Rates</code>, <code>Equipment_Rental</code>,{' '}
        <code>Materials</code> sheets and upserts by{' '}
        <code>(companyId, code)</code>. Re-runnable.
      </p>

      <input
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 block text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit(true)}
          disabled={busy || !file}
          className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Dry-run (preview only)'}
        </button>
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={busy || !file}
          className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Import (writes to DB)'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      {result ? (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
