// /files — file explorer.
//
// Plain English: SharePoint-style. Folder tree on the left, files +
// subfolders in the main pane, breadcrumbs at the top. Drop files
// into a folder by clicking Upload (or drag-drop, post-MVP). Real
// file storage on the API's persistent disk. Independent from
// /documents (the legacy metadata-only list); /documents still works
// for documents that point at SharePoint/Drive URLs.

import type { Document, Folder } from '@yge/shared';

import { AppShell } from '../../components';
import { FileExplorer } from './file-explorer';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchFolders(): Promise<Folder[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/folders`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { folders?: Folder[] };
    return body.folders ?? [];
  } catch {
    return [];
  }
}

async function fetchDocuments(): Promise<Document[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/documents`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { documents?: Document[] };
    return body.documents ?? [];
  } catch {
    return [];
  }
}

export default async function FilesPage() {
  const [folders, documents] = await Promise.all([
    fetchFolders(),
    fetchDocuments(),
  ]);
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <FileExplorer
          initialFolders={folders}
          initialDocuments={documents}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </main>
    </AppShell>
  );
}
