// Inline notes edit for /bid-tabs/[id].
//
// Operators tend to add post-import context here ('Caltrans
// rejected Mercer's bid for missing sub list — apparent low
// advanced to Knife River') after reading the agency's award
// memo or pre-bid Q&A. Tiny in-place form keeps the page from
// requiring a separate edit screen.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  apiBaseUrl: string;
  tabId: string;
  initialNotes: string;
}

export function BidTabNotesEdit({ apiBaseUrl, tabId, initialNotes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2">
        {initialNotes ? (
          <div className="whitespace-pre-wrap text-gray-700">{initialNotes}</div>
        ) : (
          <p className="text-[11px] italic text-gray-500">
            No notes yet.
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-[11px] text-yge-blue-500 hover:underline"
        >
          {initialNotes ? 'Edit notes' : 'Add notes'} →
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        maxLength={8000}
        className="w-full rounded border border-gray-300 bg-white p-2 text-xs"
        placeholder="Pre-bid attendance, addenda count, agency post-bid memo notes…"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setNotes(initialNotes);
            setEditing(false);
            setError(null);
          }}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <span className="text-[11px] text-red-700">⚠ {error}</span>}
      </div>
    </div>
  );
}
