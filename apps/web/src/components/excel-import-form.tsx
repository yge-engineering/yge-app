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
  const [peopleJobsFile, setPeopleJobsFile] = useState<File | null>(null);
  const [pjBusy, setPjBusy] = useState(false);
  const [pjResult, setPjResult] = useState<unknown>(null);
  const [pjError, setPjError] = useState<string | null>(null);
  const [estFile, setEstFile] = useState<File | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [estResult, setEstResult] = useState<unknown>(null);
  const [estError, setEstError] = useState<string | null>(null);

  async function submitEstimates(dryRun: boolean) {
    if (!estFile) {
      setEstError('Pick a file first');
      return;
    }
    setEstBusy(true);
    setEstError(null);
    setEstResult(null);
    try {
      const fd = new FormData();
      fd.append('file', estFile);
      const url = `${apiBaseUrl()}/api/admin/excel-import/estimates${dryRun ? '?dryRun=1' : ''}`;
      const res = await fetch(url, { method: 'POST', body: fd });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        setEstError((body as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      setEstResult(body);
    } catch (err) {
      setEstError((err as Error).message);
    } finally {
      setEstBusy(false);
    }
  }


  async function submitPeopleJobs(dryRun: boolean) {
    if (!peopleJobsFile) {
      setPjError('Pick a file first');
      return;
    }
    setPjBusy(true);
    setPjError(null);
    setPjResult(null);
    try {
      const fd = new FormData();
      fd.append('file', peopleJobsFile);
      const url = `${apiBaseUrl()}/api/admin/excel-import/people-jobs${dryRun ? '?dryRun=1' : ''}`;
      const res = await fetch(url, { method: 'POST', body: fd });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        setPjError((body as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      setPjResult(body);
    } catch (err) {
      setPjError((err as Error).message);
    } finally {
      setPjBusy(false);
    }
  }


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
    <div className="space-y-4">
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

    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        People &amp; jobs (Wave A2)
      </h2>
      <p className="mb-3 text-xs text-gray-600">
        Reads <code>Subcontractors</code>, <code>Employees</code>,{' '}
        <code>Jobs</code>. Subs deduped by name; employees by (first,
        last); jobs by job number. Same xlsx file as above.
      </p>
      <input
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e) => setPeopleJobsFile(e.target.files?.[0] ?? null)}
        className="mb-3 block text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submitPeopleJobs(true)}
          disabled={pjBusy || !peopleJobsFile}
          className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
        >
          {pjBusy ? 'Working…' : 'Dry-run (preview only)'}
        </button>
        <button
          type="button"
          onClick={() => void submitPeopleJobs(false)}
          disabled={pjBusy || !peopleJobsFile}
          className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {pjBusy ? 'Working…' : 'Import (writes to DB)'}
        </button>
      </div>
      {pjError ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {pjError}
        </p>
      ) : null}
      {pjResult ? (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px]">
          {JSON.stringify(pjResult, null, 2)}
        </pre>
      ) : null}
    </section>

    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Estimates (Wave A3)
      </h2>
      <p className="mb-3 text-xs text-gray-600">
        Reads every <code>Est_xx</code> sheet (Est_26-001, etc.).
        Section headers become bid items; cost lines under each are
        stored in the estimate's data blob. Dedupe by job number.
      </p>
      <input
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e) => setEstFile(e.target.files?.[0] ?? null)}
        className="mb-3 block text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submitEstimates(true)}
          disabled={estBusy || !estFile}
          className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
        >
          {estBusy ? 'Working…' : 'Dry-run (preview only)'}
        </button>
        <button
          type="button"
          onClick={() => void submitEstimates(false)}
          disabled={estBusy || !estFile}
          className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {estBusy ? 'Working…' : 'Import (writes to DB)'}
        </button>
      </div>
      {estError ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {estError}
        </p>
      ) : null}
      {estResult ? (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px]">
          {JSON.stringify(estResult, null, 2)}
        </pre>
      ) : null}
    </section>
    </div>
  );
}
