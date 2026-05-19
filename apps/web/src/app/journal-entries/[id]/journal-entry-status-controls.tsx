'use client';

// JE status transitions:
//   DRAFT  → POSTED   (Post — must be balanced; stamps postedAt)
//   POSTED → VOIDED   (Void — accounting term for reverse-and-mark;
//                      stamps voidedAt + the operator should follow
//                      with a reversing entry)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { JournalEntryStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const STATUS_TONE: Record<JournalEntryStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  POSTED: 'bg-yge-blue-100 text-yge-blue-800',
  VOIDED: 'bg-red-100 text-red-800',
};

export function JournalEntryStatusControls({
  id,
  initialStatus,
  balanced,
  postedAt,
  voidedAt,
}: {
  id: string;
  initialStatus: JournalEntryStatus;
  balanced: boolean;
  postedAt?: string;
  voidedAt?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JournalEntryStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: JournalEntryStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { status: next };
      if (next === 'POSTED' && !postedAt) patch.postedAt = new Date().toISOString();
      if (next === 'VOIDED' && !voidedAt) patch.voidedAt = new Date().toISOString();
      const res = await fetch(`${apiBaseUrl()}/api/journal-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
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
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
        <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}>
          {status}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'DRAFT' && (
          <button type="button" disabled={busy || !balanced}
            onClick={() => transition('POSTED')}
            title={balanced ? 'Post to GL' : 'Debits must equal credits before posting'}
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
            Post to GL
          </button>
        )}
        {status === 'POSTED' && (
          <button type="button" disabled={busy}
            onClick={() => {
              if (!confirm("Void this posted entry? It stays in audit history and the operator should follow with a reversing entry.")) return;
              void transition('VOIDED');
            }}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Void
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
