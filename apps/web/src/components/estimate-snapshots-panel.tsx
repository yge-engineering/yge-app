// Estimate snapshots panel — Save snapshot + history list + restore.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Snap {
  id: string;
  createdAt: string;
  label: string;
  directCostCents: number;
  bidPriceCents: number;
}

export function EstimateSnapshotsPanel({
  estimateId,
  initialSnapshots,
}: {
  estimateId: string;
  initialSnapshots: Snap[];
}) {
  const router = useRouter();
  const [snaps, setSnaps] = useState<Snap[]>(initialSnapshots);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSnaps(initialSnapshots), [initialSnapshots]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/${estimateId}/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { snapshot: Snap };
      setSnaps((prev) => [...prev, body.snapshot]);
      setLabel('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    if (!confirm('Restore this snapshot? Your current state will be auto-snapshotted first.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/imported-estimates/${estimateId}/restore/${id}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Snapshots</h3>
        <span className="text-xs text-gray-500">
          {snaps.length} saved
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (optional)"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-md bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save snapshot'}
        </button>
      </div>

      {error && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {snaps.length === 0 ? (
        <p className="text-xs text-gray-500">No snapshots yet. Save one to track significant pricing changes.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {[...snaps].reverse().map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.label}</div>
                <div className="text-xs text-gray-500">
                  {new Date(s.createdAt).toLocaleString()} · Direct{' '}
                  <Money cents={s.directCostCents} /> · Bid <Money cents={s.bidPriceCents} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void restore(s.id)}
                disabled={busy}
                className="rounded border border-yge-blue-500 px-2 py-1 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
