// Accept / Reject controls for one DIR rate proposal.
//
// Client island. Posts to /api/dir-rate-sync/proposals/:id/accept |
// reject. Accept flips the proposal to ACCEPTED AND applies the
// change to the live DirRate set in the same request — see the
// route handler. Reject requires a reason; accept's note is
// optional.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  apiBaseUrl: string;
  proposalId: string;
  /** When true, hide the controls (already reviewed). */
  disabled?: boolean;
}

export function DirProposalDecisionButtons({ apiBaseUrl, proposalId, disabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (disabled) return null;

  async function accept() {
    if (busy) return;
    const note = window.prompt(
      'Optional note for the audit trail. Leave blank to accept without comment.',
      '',
    );
    // window.prompt returns null on cancel, '' on empty submit.
    if (note === null) return;
    setError(null);
    setBusy('accept');
    try {
      const res = await fetch(`${apiBaseUrl}/api/dir-rate-sync/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note ? { reviewNote: note } : {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `API returned ${res.status}`);
        setBusy(null);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (busy) return;
    const reason = window.prompt(
      'Why reject this proposal? Required — the reason lands in the audit log.',
      '',
    );
    if (reason === null) return;
    if (reason.trim().length === 0) {
      window.alert('Reject reason is required.');
      return;
    }
    setError(null);
    setBusy('reject');
    try {
      const res = await fetch(`${apiBaseUrl}/api/dir-rate-sync/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote: reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `API returned ${res.status}`);
        setBusy(null);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={accept}
        disabled={busy != null}
        className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === 'accept' ? 'Accepting…' : 'Accept'}
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={busy != null}
        className="rounded border border-red-600 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy === 'reject' ? 'Rejecting…' : 'Reject'}
      </button>
      {error && (
        <span className="text-xs text-red-700" title={error}>
          ⚠ {error.length > 40 ? error.slice(0, 40) + '…' : error}
        </span>
      )}
    </span>
  );
}
