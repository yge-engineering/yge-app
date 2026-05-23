'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  apiBaseUrl: string;
}

export function SnapshotButton({ apiBaseUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function take() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: note.trim() || undefined,
          triggeredBy: 'manual',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. before bid push)"
        className="w-72 rounded border border-gray-300 px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={take}
        disabled={busy}
        className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? 'Taking snapshot…' : 'Snapshot now'}
      </button>
      {error && (
        <p className="rounded bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
