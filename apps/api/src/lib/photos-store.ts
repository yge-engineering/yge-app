// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for field photo metadata.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PhotoSchema,
  newPhotoId,
  type Photo,
  type PhotoCreate,
  type PhotoPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return process.env.PHOTOS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'photos');
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

async function readIndex(): Promise<Photo[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = PhotoSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((p): p is Photo => p !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Photo[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createPhoto(
  input: PhotoCreate,
  ctx?: AuditContext,
): Promise<Photo> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newPhotoId();
  const p: Photo = {
    id,
    createdAt: now,
    updatedAt: now,
    category: input.category ?? 'PROGRESS',
    ...input,
  };
  PhotoSchema.parse(p);
  await fs.writeFile(rowPath(id), JSON.stringify(p, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(p);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Photo',
    entityId: id,
    after: p,
    ctx,
  });
  return p;
}

export async function listPhotos(filter?: {
  jobId?: string;
  category?: string;
}): Promise<Photo[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((p) => p.jobId === filter.jobId);
  if (filter?.category) all = all.filter((p) => p.category === filter.category);
  all.sort((a, b) => b.takenOn.localeCompare(a.takenOn));
  return all;
}

export async function getPhoto(id: string): Promise<Photo | null> {
  if (!/^ph-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return PhotoSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updatePhoto(
  id: string,
  patch: PhotoPatch,
  ctx?: AuditContext,
  auditAction: 'update' = 'update',
): Promise<Photo | null> {
  const existing = await getPhoto(id);
  if (!existing) return null;
  const updated: Photo = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  PhotoSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((p) => p.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Photo',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
