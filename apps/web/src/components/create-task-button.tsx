// "Add to my Outlook To-Do" button.

'use client';

import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function CreateTaskButton({
  email,
  title,
  body,
  dueDate,
  label = 'Add to my To-Do',
}: {
  email: string;
  title: string;
  body?: string;
  dueDate?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/microsoft/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, title, body, dueDate }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800">
        ✓ Added to To-Do
      </span>
    );
  }
  return (
    <span>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-yge-blue-600 bg-white px-2 py-0.5 text-[11px] font-semibold text-yge-blue-700 hover:bg-yge-blue-100 disabled:opacity-50"
      >
        {busy ? 'Adding…' : `☑️ ${label}`}
      </button>
      {error ? (
        <span className="ml-2 text-[11px] text-red-700">{error}</span>
      ) : null}
    </span>
  );
}
