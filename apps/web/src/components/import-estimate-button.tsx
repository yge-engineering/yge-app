// Excel / CSV import button for the estimates list page.
//
// Drop in an .xlsx (multi-tab workbook is fine — pick the tab in
// the next step) or a .csv. Required columns: itemNumber,
// description, unit, quantity. unitPrice optional. Header row
// auto-detected.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface ImportEstimateButtonProps {
  /** When set, the dialog skips the job dropdown and pins the import
   *  to this job. Used by the per-job button on /jobs/[id]. */
  presetJobId?: string;
  /** Optional override for the trigger label. */
  label?: string;
}

export function ImportEstimateButton({
  presetJobId,
  label,
}: ImportEstimateButtonProps = {}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState(presetJobId ?? '');
  const [projectName, setProjectName] = useState('');
  const [availableSheets, setAvailableSheets] = useState<string[] | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [markAllReviewed, setMarkAllReviewed] = useState(true);

  // Fetch jobs once when the dialog opens, unless we have a presetJobId.
  useEffect(() => {
    if (!open) return;
    if (presetJobId) {
      // Just resolve the project name for the preset job.
      void (async () => {
        try {
          const res = await fetch(
            `${apiBaseUrl()}/api/jobs/${encodeURIComponent(presetJobId)}`,
            { cache: 'no-store' },
          );
          if (!res.ok) return;
          const body = (await res.json()) as { job?: Job };
          if (body.job) {
            setJobs([body.job]);
            setProjectName((p) => p || body.job!.projectName);
          }
        } catch {
          /* ignore */
        }
      })();
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${apiBaseUrl()}/api/jobs`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { jobs: Job[] };
        const sorted = [...body.jobs].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        setJobs(sorted);
      } catch {
        /* ignore — user can still type the job id by hand if we
         *  surface a fallback in the future */
      }
    })();
  }, [open, presetJobId]);

  function reset() {
    setError(null);
    setAvailableSheets(null);
    setSheetName('');
  }

  function onJobChange(next: string) {
    setJobId(next);
    const job = jobs.find((j) => j.id === next);
    if (job && !projectName) {
      setProjectName(job.projectName);
    }
  }

  async function submit() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Pick a file first.');
      return;
    }
    if (!jobId.trim() || !projectName.trim()) {
      setError('Job and project name are both required.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('jobId', jobId.trim());
      fd.append('projectName', projectName.trim());
      if (sheetName) fd.append('sheetName', sheetName);
      const res = await fetch(
        `${apiBaseUrl()}/api/priced-estimates/import-csv`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          availableSheets?: string[];
          summary?: { skippedReasons?: string[] };
        };
        if (body.availableSheets && body.availableSheets.length > 0) {
          setAvailableSheets(body.availableSheets);
          setSheetName(body.availableSheets[0] ?? '');
          setError(null);
          return;
        }
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
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-md border border-yge-blue-500 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
      >
        {label ?? '⬆ Import from Excel / CSV'}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md bg-white p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-gray-900">
          Import bid items from Excel / CSV
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Drop in an <code className="font-mono">.xlsx</code> (multi-tab is
          fine — pick the right tab in the next step) or a{' '}
          <code className="font-mono">.csv</code>. Required columns:{' '}
          <code className="font-mono">itemNumber</code>,{' '}
          <code className="font-mono">description</code>,{' '}
          <code className="font-mono">unit</code>,{' '}
          <code className="font-mono">quantity</code>. Optional:{' '}
          <code className="font-mono">unitPrice</code>.
        </p>

        <label className="mt-4 block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Job</span>
          {presetJobId ? (
            <input
              type="text"
              value={jobs[0]?.projectName ?? presetJobId}
              readOnly
              className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm"
            />
          ) : (
            <select
              value={jobId}
              onChange={(e) => onJobChange(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              required
            >
              <option value="">Pick a job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.projectName}
                  {j.ownerAgency ? ` — ${j.ownerAgency}` : ''}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-medium text-gray-700">
            Project name
            <span className="ml-1 text-[11px] text-gray-500">
              (auto-filled from job — you can override)
            </span>
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
            Excel / CSV file
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xlsm,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={() => {
              setAvailableSheets(null);
              setSheetName('');
            }}
            className="text-xs"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={markAllReviewed}
            onChange={(e) => setMarkAllReviewed(e.target.checked)}
          />
          Mark imported lines as reviewed (skip the unreviewed counter)
        </label>

        {availableSheets ? (
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-gray-700">
              Pick the sheet that holds the bid items
            </span>
            <select
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {availableSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Click "Import this sheet" once you've picked the right one.
            </p>
          </label>
        ) : null}

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
            {busy
              ? 'Importing…'
              : availableSheets
                ? 'Import this sheet + open editor'
                : 'Import + open editor'}
          </button>
        </div>
      </form>
    </div>
  );
}
