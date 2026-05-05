'use client';

// OneDriveRecentPanel — small client island shown on /files when the
// user is connected to Microsoft 365. Lists the 20 most recent files
// from the user's OneDrive, with click-to-open-in-OneDrive links.
//
// Hidden by default behind a "Show OneDrive recent" toggle so the
// page doesn't fire a Graph call until the user asks for it.

import { useState } from 'react';

interface OneDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  size?: number;
  kind: 'file' | 'folder';
  mimeType?: string;
}

interface Props {
  apiBaseUrl: string;
  userEmail: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OneDriveRecentPanel({ apiBaseUrl, userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OneDriveItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!userEmail) {
      setError('Sign in first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/microsoft/onedrive/recent`);
      url.searchParams.set('email', userEmail);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Load failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { items: OneDriveItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void load();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <span>OneDrive — recent files</span>
        <span className="text-xs text-gray-500">{open ? 'Hide ▴' : 'Show ▾'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-200 p-3">
          {busy && <p className="text-xs text-gray-500">Loading from Microsoft Graph…</p>}
          {error && <p className="text-xs text-red-700">{error}</p>}
          {!busy && items && items.length === 0 && (
            <p className="text-xs text-gray-500">No recent OneDrive files.</p>
          )}
          {!busy && items && items.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">
                      {it.kind === 'folder' ? '📁 ' : '📄 '}
                      {it.name}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {[
                        formatWhen(it.lastModifiedDateTime),
                        formatBytes(it.size),
                        it.mimeType,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {it.webUrl && (
                    <a
                      href={it.webUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
                    >
                      Open ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
