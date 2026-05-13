// "Add to my Outlook calendar" button.

'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function AddToCalendarButton({
  email,
  subject,
  startDateTime,
  endDateTime,
  location,
  body,
  isAllDay,
  label = 'Add to Outlook calendar',
}: {
  email: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  body?: string;
  isAllDay?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ webLink: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/microsoft/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject,
          startDateTime,
          endDateTime,
          location,
          body,
          isAllDay: !!isAllDay,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Push failed (${res.status})`);
        return;
      }
      const out = (await res.json()) as { webLink: string | null };
      setDone({ webLink: out.webLink });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return done.webLink ? (
      <a
        href={done.webLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"
      >
        ✓ Added · open in Outlook
      </a>
    ) : (
      <span className="text-xs text-green-700">✓ Added to calendar</span>
    );
  }
  return (
    <span>
      <button
        type="button"
        onClick={push}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-yge-blue-600 bg-white px-2 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
      >
        {busy ? 'Adding…' : `📅 ${label}`}
      </button>
      {error ? (
        <span className="ml-2 text-xs text-red-700">{error}</span>
      ) : null}
    </span>
  );
}
