// Folders store — file-backed CRUD for the /files explorer.
//
// Plain English: folders are nodes in a tree. Each folder has a
// parent (or null for root). The store keeps an index.json with all
// folders flat, plus per-folder JSON rows. Same shape as the other
// stores so we can swap in Postgres later without touching the
// route layer.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  FolderSchema,
  newFolderId,
  type Folder,
  type FolderCreate,
  type FolderPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.FOLDERS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'folders')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Folder[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = FolderSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((f): f is Folder => f !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Folder[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function listFolders(): Promise<Folder[]> {
  await ensureDir();
  return await readIndex();
}

export async function getFolder(id: string): Promise<Folder | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    const parsed = FolderSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createFolder(
  input: FolderCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<Folder> {
  await ensureDir();
  const now = new Date().toISOString();
  const folder: Folder = FolderSchema.parse({
    ...input,
    id: newFolderId(),
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(rowPath(folder.id), JSON.stringify(folder, null, 2), 'utf8');
  const idx = await readIndex();
  idx.push(folder);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'Folder',
    entityId: folder.id,
    action: 'create',
    before: null,
    after: folder,
    ctx,
  });
  return folder;
}

export async function updateFolder(
  id: string,
  patch: FolderPatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<Folder | null> {
  const existing = await getFolder(id);
  if (!existing) return null;
  // Guard against simple cycle: setting parent to self or a descendant.
  if (patch.parentFolderId === id) {
    throw new Error('Folder cannot be its own parent');
  }
  if (patch.parentFolderId) {
    const folders = await readIndex();
    const byId = new Map(folders.map((f) => [f.id, f]));
    let cursor: Folder | undefined = byId.get(patch.parentFolderId);
    let safety = 64;
    while (cursor && safety-- > 0) {
      if (cursor.id === id) {
        throw new Error('Cannot move folder into its own descendant');
      }
      cursor = cursor.parentFolderId ? byId.get(cursor.parentFolderId) : undefined;
    }
  }
  const merged: Folder = FolderSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(rowPath(id), JSON.stringify(merged, null, 2), 'utf8');
  const idx = await readIndex();
  const i = idx.findIndex((f) => f.id === id);
  if (i >= 0) idx[i] = merged;
  else idx.push(merged);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'Folder',
    entityId: id,
    action: 'update',
    before: existing,
    after: merged,
    ctx,
  });
  return merged;
}

export async function deleteFolder(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getFolder(id);
  if (!existing) return false;
  await fs.unlink(rowPath(id)).catch(() => undefined);
  const idx = await readIndex();
  const next = idx.filter((f) => f.id !== id);
  // Reparent any direct children to the deleted folder's parent so
  // they aren't orphaned. The route layer is responsible for moving
  // documents — we only handle folders here.
  for (const f of next) {
    if (f.parentFolderId === id) {
      f.parentFolderId = existing.parentFolderId ?? null;
      await fs.writeFile(rowPath(f.id), JSON.stringify(f, null, 2), 'utf8');
    }
  }
  await writeIndex(next);
  await recordAudit({
    entityType: 'Folder',
    entityId: id,
    action: 'delete',
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
