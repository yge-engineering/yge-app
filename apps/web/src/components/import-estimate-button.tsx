// CSV import button for the estimates list page.
//
// Plain English: Ryan works the bid in Excel, hits File → Save As →
// CSV, drops the file here, and lands in the editor with the items
// already populated. Required columns: itemNumber, description,
// unit, quantity. unitPrice is optional. First row can be a header.

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ImportEstimateButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState('');
  const [projectName, setProjectName] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Pick a CSV file first.');
      return;
    }
    if (!jobId.trim() || !projectName.trim()) {
      setError('Job id and project name are both required.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('jobId', jobId.trim());
      fd.append('projectName', projectName.trim());
      const res = await fetch(
        `${apiBaseUrl()}/api/priced-estimates/import-csv`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          summary?: { skippedReasons?: string[] };
        };
        const reasons = body.summary?.skippedReasons?.length
          ? ` (${body.summary.skippedReasons.join('; ')})`
          : '';
        setError(`${body.error ?? `Import failed (${res.status})`}${reasons}`);
        return;
      }
      const body = (await res.json()) as { estimate: { id: string } };
      router.push(`/estimates/${body.estimate.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-yge-blue-500 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
      >
        ⬆ Import from CSV
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md bg-white p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-gray-900">
          Import bid items from CSV
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          In Excel: <strong>File → Save As → CSV (UTF-8)</strong>. Required
          columns: <code className="font-mono">itemNumber</code>,{' '}
          <code className="font-mono">description</code>,{' '}
          <code className="font-mono">unit</code>,{' '}
          <code className="font-mono">quantity</code>. Optional:{' '}
          <code className="font-mono">unitPrice</code>. A header row is
          auto-detected.
        </p>

        <label className="mt-4 block text-xs">
          <span className="mb-1 block font-medium text-gray-700">
            Job ID
          </span>
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="job-2026-..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
            required
          />
        </label>
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-medium text-gray-700">
            Project name
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Sulphur Springs Road Resurfacing"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            required
          />
        </label>
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-medium text-gray-700">
            CSV file
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="text-xs"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import + open editor'}
          </button>
        </div>
      </form>
    </div>
  );
}
