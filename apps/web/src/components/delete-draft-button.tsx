'use client';

// Delete-draft button. Soft-deletes via the API (the row stays in
// Postgres with deletedAt set; per CLAUDE.md prohibited-actions we
// never hard-delete user data). Two visual variants:
//
//   variant="row"     — compact link-style button for the /drafts
//                       table; on success refreshes the list in place
//   variant="detail"  — full button for the /drafts/[id] page; on
//                       success navigates back to /drafts
//
// Confirms via the browser confirm() dialog. A future iteration can
// upgrade to a modal with the project name + "type to confirm".

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  draftId: string;
  draftLabel: string;
  apiBaseUrl: string;
  variant?: 'row' | 'detail';
}

export function DeleteDraftButton({
  draftId,
  draftLabel,
  apiBaseUrl,
  variant = 'row',
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      `Delete this draft?\n\n"${draftLabel}"\n\nThe draft hides from your list immediately. The row stays in the database so it can be recovered if you change your mind.`,
    );
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/plans-to-estimate/drafts/${encodeURIComponent(draftId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (variant === 'detail') {
        router.push('/drafts');
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'detail') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={handleClick}
          disabled={busy}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete draft'}
        </button>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        title="Delete this draft"
        className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? '…' : 'Delete'}
      </button>
      {error && <span className="ml-1 text-[10px] text-red-700">{error}</span>}
    </>
  );
}
