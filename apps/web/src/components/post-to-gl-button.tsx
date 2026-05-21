'use client';

// Drafts a general-ledger journal entry from an AR invoice or AP bill via
// POST /api/{entity}/:id/post-to-gl, then links to the draft for review.
// The entry is created as DRAFT — posting to the GL stays a human step on
// the journal-entry page.

import { useState } from 'react';

interface PostResult {
  tone: 'ok' | 'info' | 'error';
  message: string;
  journalEntryId?: string;
}

export function PostToGlButton({
  apiBaseUrl,
  entity,
  id,
}: {
  apiBaseUrl: string;
  entity: 'ar-invoices' | 'ap-invoices';
  id: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);

  async function post() {
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/${entity}/${encodeURIComponent(id)}/post-to-gl`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as {
        journalEntryId?: string;
        error?: string;
      };
      if (res.status === 409) {
        setResult({ tone: 'info', message: 'Already posted to the GL.', journalEntryId: body.journalEntryId });
      } else if (!res.ok) {
        setResult({ tone: 'error', message: body.error ?? `HTTP ${res.status}` });
      } else {
        setResult({ tone: 'ok', message: 'Draft journal entry created — review and post it.', journalEntryId: body.journalEntryId });
      }
    } catch (err) {
      setResult({ tone: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const toneClass =
    result?.tone === 'error'
      ? 'text-red-700'
      : result?.tone === 'info'
        ? 'text-amber-800'
        : 'text-green-700';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        disabled={busy}
        onClick={() => void post()}
        className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? 'Posting…' : 'Post to GL (draft)'}
      </button>
      <span className="text-[11px] text-gray-500">
        Creates a draft journal entry; review &amp; post it on the journal-entry page.
      </span>
      {result && (
        <span className={`text-xs font-medium ${toneClass}`}>
          {result.message}
          {result.journalEntryId && (
            <a href={`/journal-entries/${result.journalEntryId}`} className="ml-1 underline">
              Review →
            </a>
          )}
        </span>
      )}
    </div>
  );
}
