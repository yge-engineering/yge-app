'use client';

// File explorer UI — folder tree + content grid + upload + breadcrumbs.
//
// Plain English: a small SharePoint. Click a folder on the left, see
// its subfolders + files in the middle. Click a file to download/open
// in a new tab. New Folder + Upload buttons sit in the breadcrumb
// bar. Right-click a row → rename / move / delete (post-MVP; for now
// rename + delete via inline buttons on hover).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFolderTree,
  folderBreadcrumbs,
  type Document,
  type Folder,
  type FolderNode,
} from '@yge/shared';

interface Props {
  initialFolders: Folder[];
  initialDocuments: Document[];
  apiBaseUrl: string;
  /** Email of the signed-in user, lowercase. Empty when not signed in.
   *  Used to query Microsoft connection status + show their email on
   *  the Connect button. */
  currentUserEmail?: string;
}

function fmtBytes(n: number | undefined): string {
  if (!n || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
}

export function FileExplorer({
  initialFolders,
  initialDocuments,
  apiBaseUrl,
  currentUserEmail,
}: Props) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Microsoft 365 connection state. When the user clicks Connect we
  // bounce out to Microsoft, OAuth, then come back with
  // ?microsoft=connected so the page can refresh the chip.
  const [msStatus, setMsStatus] = useState<{
    connected: boolean;
    configured: boolean;
  }>({ connected: false, configured: true });

  useEffect(() => {
    if (!currentUserEmail) return;
    let cancelled = false;
    async function loadStatus() {
      try {
        const r = await fetch(
          `${apiBaseUrl}/api/microsoft/status?email=${encodeURIComponent(currentUserEmail!)}`,
          { cache: 'no-store' },
        );
        if (!r.ok) return;
        const j = (await r.json()) as { connected: boolean; configured: boolean };
        if (!cancelled) setMsStatus({ connected: j.connected, configured: j.configured });
      } catch {
        // network blip — leave defaults
      }
    }
    void loadStatus();
    // Surface ?microsoft=connected / =error from the OAuth callback.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ms = params.get('microsoft');
      if (ms === 'connected') {
        setError(null);
        // Clean the param so a refresh doesn't repeat the toast.
        const u = new URL(window.location.href);
        u.searchParams.delete('microsoft');
        u.searchParams.delete('email');
        u.searchParams.delete('name');
        window.history.replaceState({}, '', u.toString());
        void loadStatus();
      } else if (ms === 'error') {
        const reason = params.get('reason') ?? 'Microsoft connect failed.';
        setError(`Microsoft connect failed: ${reason}`);
        const u = new URL(window.location.href);
        u.searchParams.delete('microsoft');
        u.searchParams.delete('reason');
        window.history.replaceState({}, '', u.toString());
      }
    }
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, currentUserEmail]);

  async function connectMicrosoft() {
    setBusy(true);
    setError(null);
    try {
      const ret =
        typeof window !== 'undefined' ? window.location.href.split('?')[0]! : '/files';
      const r = await fetch(
        `${apiBaseUrl}/api/microsoft/auth-url?return=${encodeURIComponent(ret)}`,
      );
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`Could not start Microsoft sign-in: ${t.slice(0, 120)}`);
      }
      const j = (await r.json()) as { url: string };
      window.location.href = j.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microsoft connect failed.');
      setBusy(false);
    }
  }

  async function disconnectMicrosoft() {
    if (!currentUserEmail) return;
    if (!confirm('Disconnect Microsoft 365 from YGE?')) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${apiBaseUrl}/api/microsoft/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail }),
      });
      if (!r.ok) throw new Error(`Disconnect failed (${r.status})`);
      setMsStatus({ ...msStatus, connected: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed.');
    } finally {
      setBusy(false);
    }
  }

  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const breadcrumbs = useMemo(
    () => folderBreadcrumbs(currentFolderId, folders),
    [currentFolderId, folders],
  );

  const subFolders = useMemo(
    () =>
      folders
        .filter((f) => (f.parentFolderId ?? null) === currentFolderId)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
    [folders, currentFolderId],
  );

  const folderDocs = useMemo(
    () =>
      documents
        .filter((d) => (d.folderId ?? null) === currentFolderId)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [documents, currentFolderId],
  );

  async function refetch() {
    try {
      const [fRes, dRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/folders`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/documents`, { cache: 'no-store' }),
      ]);
      if (fRes.ok) {
        const body = (await fRes.json()) as { folders: Folder[] };
        setFolders(body.folders);
      }
      if (dRes.ok) {
        const body = (await dRes.json()) as { documents: Document[] };
        setDocuments(body.documents);
      }
    } catch {
      // network blip — keep current state
    }
  }

  async function newFolder() {
    const name = prompt('Folder name?');
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parentFolderId: currentFolderId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  }

  async function renameFolder(f: Folder) {
    const name = prompt('Rename folder', f.name);
    if (!name || name.trim() === f.name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/folders/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(f: Folder) {
    if (
      !confirm(
        `Delete folder "${f.name}"?\n\nFiles inside it will move up to the parent folder.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/folders/${f.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // If we were inside the deleted folder, hop to its parent.
      if (currentFolderId === f.id) {
        setCurrentFolderId(f.parentFolderId ?? null);
      }
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', file.name);
        if (currentFolderId) fd.append('folderId', currentFolderId);
        const res = await fetch(`${apiBaseUrl}/api/documents/upload`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Upload failed (${res.status}): ${text.slice(0, 120)}`);
        }
      }
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(d: Document) {
    if (!confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      // No DELETE endpoint yet — soft-delete via PATCH would need a
      // `deleted` flag. For now, hide from this UI by setting kind to
      // OTHER + folderId null. Wire up a real /documents DELETE in a
      // follow-up bundle.
      const res = await fetch(`${apiBaseUrl}/api/documents/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: null, tags: [...(d.tags ?? []), 'deleted'] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Auto-expand ancestors of the current folder so the tree shows it.
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const c of breadcrumbs) {
        if (c.parentFolderId) next.add(c.parentFolderId);
      }
      return next;
    });
  }, [breadcrumbs]);

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      {/* Tree sidebar */}
      <aside className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Folders</h2>
          <button
            type="button"
            onClick={newFolder}
            disabled={busy}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            + New
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={`w-full rounded px-2 py-1 text-left text-sm ${currentFolderId === null ? 'bg-blue-100 font-semibold text-blue-900' : 'text-gray-800 hover:bg-gray-100'}`}
        >
          All files
        </button>
        <div className="mt-1 space-y-0.5">
          {tree.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">
              No folders yet. Click "+ New" to create one.
            </p>
          ) : (
            tree.map((node) => (
              <FolderTreeNode
                key={node.folder.id}
                node={node}
                depth={0}
                currentFolderId={currentFolderId}
                expanded={expanded}
                onSelect={setCurrentFolderId}
                onToggle={toggleExpanded}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main pane */}
      <section className="space-y-3">
        {/* Breadcrumbs + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className="font-semibold text-blue-700 hover:underline"
            >
              All files
            </button>
            {breadcrumbs.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1">
                <span className="text-gray-400">/</span>
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(b.id)}
                  className={
                    i === breadcrumbs.length - 1
                      ? 'font-semibold text-gray-900'
                      : 'text-blue-700 hover:underline'
                  }
                >
                  {b.name}
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Working…' : '⬆ Upload files'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => uploadFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={newFolder}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              + New folder
            </button>
            {currentUserEmail && msStatus.configured && (
              msStatus.connected ? (
                <button
                  type="button"
                  onClick={disconnectMicrosoft}
                  disabled={busy}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  title="Click to disconnect Microsoft 365"
                >
                  ✓ Microsoft 365 connected
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connectMicrosoft}
                  disabled={busy}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Connect Microsoft 365
                </button>
              )
            )}
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Subfolders + files grid */}
        {subFolders.length === 0 && folderDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              This folder is empty.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Drop files in via "Upload files" or create a subfolder.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subFolders.map((f) => (
                  <tr key={f.id} className="group hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(f.id)}
                        className="flex items-center gap-2 text-left text-blue-700 hover:underline"
                      >
                        <span aria-hidden="true">📁</span>
                        <span className="font-medium">{f.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">Folder</td>
                    <td className="px-3 py-2 text-xs text-gray-400">—</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {fmtDate(f.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => renameFolder(f)}
                        className="text-xs text-gray-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                      >
                        Rename
                      </button>
                      <span className="px-1 text-gray-300 opacity-0 group-hover:opacity-100">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteFolder(f)}
                        className="text-xs text-red-700 opacity-0 transition group-hover:opacity-100 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {folderDocs.map((d) => (
                  <tr key={d.id} className="group hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {d.hasBlob ? (
                        <a
                          href={`${apiBaseUrl}/api/documents/${d.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-700 hover:underline"
                        >
                          <span aria-hidden="true">📄</span>
                          <span className="font-medium">{d.title}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-700">
                          <span aria-hidden="true">📄</span>
                          <span className="font-medium">{d.title}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {d.hasBlob ? d.mimeType ?? 'File' : d.kind}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {d.hasBlob ? fmtBytes(d.fileSize) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {fmtDate(d.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.hasBlob && (
                        <a
                          href={`${apiBaseUrl}/api/documents/${d.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-2 text-xs text-gray-600 opacity-0 transition group-hover:opacity-100 hover:underline"
                        >
                          Open
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteDocument(d)}
                        className="text-xs text-red-700 opacity-0 transition group-hover:opacity-100 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FolderTreeNode({
  node,
  depth,
  currentFolderId,
  expanded,
  onSelect,
  onToggle,
}: {
  node: FolderNode;
  depth: number;
  currentFolderId: string | null;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const isOpen = expanded.has(node.folder.id);
  const isCurrent = currentFolderId === node.folder.id;
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded px-1 py-0.5 ${isCurrent ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.folder.id)}
            className="flex h-5 w-5 items-center justify-center text-gray-500"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="inline-block h-5 w-5" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.folder.id)}
          className={`flex-1 truncate text-left text-sm ${isCurrent ? 'font-semibold text-blue-900' : 'text-gray-800'}`}
        >
          📁 {node.folder.name}
        </button>
      </div>
      {isOpen &&
        node.children.map((c) => (
          <FolderTreeNode
            key={c.folder.id}
            node={c}
            depth={depth + 1}
            currentFolderId={currentFolderId}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}
