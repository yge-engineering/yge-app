// OneDrive document picker.
//
// Modal that lets the user browse their personal OneDrive and pick
// a file. Used wherever an "Attach a OneDrive file" capability is
// needed (RFI, change order, lien waiver, etc.).

'use client';

import { useEffect, useState } from 'react';

interface DriveItemLite {
  id: string;
  name: string;
  webUrl: string | null;
  isFolder: boolean;
  size: number;
  mimeType: string | null;
  lastModifiedDateTime: string | null;
}

interface BreadcrumbEntry {
  id: string | undefined;
  name: string;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface PickedFile {
  id: string;
  name: string;
  webUrl: string | null;
  mimeType: string | null;
}

export function OneDrivePicker({
  email,
  open,
  onClose,
  onPick,
}: {
  email: string;
  open: boolean;
  onClose: () => void;
  onPick: (file: PickedFile) => void;
}) {
  const [items, setItems] = useState<DriveItemLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: undefined, name: 'OneDrive root' },
  ]);

  async function browse(parentItemId: string | undefined) {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ email });
      if (parentItemId) q.set('parentItemId', parentItemId);
      const res = await fetch(
        `${apiBaseUrl()}/api/microsoft/onedrive/browse?${q.toString()}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Browse failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { items: DriveItemLite[] };
      // Folders first, then alphabetical.
      body.items.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setBreadcrumbs([{ id: undefined, name: 'OneDrive root' }]);
      void browse(undefined);
    } else {
      setItems(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function enterFolder(item: DriveItemLite) {
    setBreadcrumbs((bc) => [...bc, { id: item.id, name: item.name }]);
    void browse(item.id);
  }

  function jumpTo(index: number) {
    const newBc = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBc);
    const last = newBc[newBc.length - 1];
    void browse(last?.id);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Pick a file from OneDrive
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <nav className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 ? <span className="text-gray-400">/</span> : null}
              {i < breadcrumbs.length - 1 ? (
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  className="text-yge-blue-700 hover:underline"
                >
                  {bc.name}
                </button>
              ) : (
                <span className="font-semibold text-gray-800">{bc.name}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="max-h-[60vh] overflow-y-auto">
          {error ? (
            <p className="m-4 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="p-4 text-xs text-gray-600">Loading…</p>
          ) : items && items.length === 0 ? (
            <p className="p-4 text-xs text-gray-600">(Empty folder)</p>
          ) : items ? (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      item.isFolder
                        ? enterFolder(item)
                        : onPick({
                            id: item.id,
                            name: item.name,
                            webUrl: item.webUrl,
                            mimeType: item.mimeType,
                          })
                    }
                    className="flex w-full items-center justify-between gap-3 rounded p-1 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0">
                        {item.isFolder ? '📁' : '📄'}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    {!item.isFolder ? (
                      <span className="shrink-0 text-xs text-gray-500">
                        {formatSize(item.size)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <footer className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          Click a folder to enter it. Click a file to attach it.
        </footer>
      </div>
    </div>
  );
}
