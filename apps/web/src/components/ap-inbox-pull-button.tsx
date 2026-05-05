'use client';

// ApInboxPullButton — client island on /ap-invoices that calls
// POST /api/microsoft/ap-inbox-poll, surfaces the count of new
// invoice rows created, and refreshes the page so they show up.
//
// Requires the user to have connected Microsoft 365 first (see
// /files → Connect Microsoft 365). Without a token the button still
// shows but the click reports a friendly error.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  apiBaseUrl: string;
  /** Email of the YGE user whose Microsoft tokens to use. */
  userEmail: string;
  /** Shared mailbox to poll. Default ap@youngge.com (server side). */
  mailbox?: string;
}

interface PollResponse {
  scanned: number;
  ingested: number;
  skipped: number;
  newInvoices: { id: string; vendorName: string; subject: string }[];
}

export function ApInboxPullButton({ apiBaseUrl, userEmail, mailbox }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pull() {
    if (!userEmail) {
      setError('Sign in first so the API knows whose Microsoft tokens to use.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { userEmail };
      if (mailbox) body.mailbox = mailbox;
      const res = await fetch(`${apiBaseUrl}/api/microsoft/ap-inbox-poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Pull failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as PollResponse;
      const summary =
        data.ingested === 0
          ? `No new invoices (${data.scanned} message${data.scanned === 1 ? '' : 's'} scanned).`
          : `${data.ingested} new invoice${data.ingested === 1 ? '' : 's'} created from ${data.scanned} message${data.scanned === 1 ? '' : 's'}.`;
      setMessage(summary);
      if (data.ingested > 0) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={pull}
        disabled={busy}
        className="inline-flex items-center rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {busy ? 'Pulling…' : 'Pull from ap@'}
      </button>
      {message && <span className="text-xs text-green-700">{message}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
