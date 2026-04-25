'use client';

// Inline status pill on the job detail page. Lets the estimator move a job
// from PURSUING → BID_SUBMITTED → AWARDED/LOST without leaving the page.
// PATCHes /api/jobs/:id and reloads on success so the rest of the page
// reflects the new status.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { statusLabel, type Job, type JobStatus } from '@yge/shared';
import { ApiError, patchJson } from '@/lib/api';

const STATUSES: JobStatus[] = [
  'PROSPECT',
  'PURSUING',
  'BID_SUBMITTED',
  'AWARDED',
  'LOST',
  'NO_BID',
  'ARCHIVED',
];

function pillClass(status: JobStatus): string {
  switch (status) {
    case 'PROSPECT':
      return 'bg-gray-100 text-gray-800';
    case 'PURSUING':
      return 'bg-yellow-100 text-yellow-800';
    case 'BID_SUBMITTED':
      return 'bg-blue-100 text-blue-800';
    case 'AWARDED':
      return 'bg-green-100 text-green-800';
    case 'LOST':
      return 'bg-red-100 text-red-800';
    case 'NO_BID':
      return 'bg-gray-200 text-gray-700';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-500';
  }
}

export function JobStatusEditor({
  jobId,
  initialStatus,
}: {
  jobId: string;
  initialStatus: JobStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: JobStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      await patchJson<{ job: Job }>(`/api/jobs/${encodeURIComponent(jobId)}`, {
        status: next,
      });
      router.refresh();
    } catch (err) {
      setStatus(prev); // rollback
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide ${pillClass(status)}`}
        >
          {statusLabel(status)}
        </span>
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value as JobStatus)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
          disabled={saving}
          aria-label="Change job status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
