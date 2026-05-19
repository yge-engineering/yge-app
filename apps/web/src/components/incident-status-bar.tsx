'use client';

// One-tap status transitions for an OSHA 300/301 incident.
//
// OPEN → CLOSED   (Close the case — usually when the employee returns to
//                  full duty + the OSHA 301 form is in the binder)
// CLOSED → OPEN   (Reopen — rare; usually triggered by a recurrence or
//                  Cal/OSHA asking follow-up questions)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IncidentStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-700',
};

export function IncidentStatusBar({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: IncidentStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<IncidentStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: IncidentStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Transition failed (${res.status}).`);
        return;
      }
      setStatus(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Case status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'OPEN' ? (
          <button type="button" disabled={busy} onClick={() => transition('CLOSED')}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Close case
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => transition('OPEN')}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            Reopen case
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
