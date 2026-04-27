// File-based store for lien waivers.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  LienWaiverSchema,
  newLienWaiverId,
  type LienWaiver,
  type LienWaiverCreate,
  type LienWaiverPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.LIEN_WAIVERS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'lien-waivers');
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

async function readIndex(): Promise<LienWaiver[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = LienWaiverSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((w): w is LienWaiver => w !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: LienWaiver[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createLienWaiver(input: LienWaiverCreate): Promise<LienWaiver> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newLienWaiverId();
  const w: LienWaiver = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    ...input,
  };
  LienWaiverSchema.parse(w);
  await fs.writeFile(rowPath(id), JSON.stringify(w, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(w);
  await writeIndex(index);
  return w;
}

export async function listLienWaivers(filter?: {
  jobId?: string;
  status?: string;
}): Promise<LienWaiver[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((w) => w.jobId === filter.jobId);
  if (filter?.status) all = all.filter((w) => w.status === filter.status);
  all.sort((a, b) => b.throughDate.localeCompare(a.throughDate));
  return all;
}

export async function getLienWaiver(id: string): Promise<LienWaiver | null> {
  if (!/^lw-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return LienWaiverSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateLienWaiver(
  id: string,
  patch: LienWaiverPatch,
): Promise<LienWaiver | null> {
  const existing = await getLienWaiver(id);
  if (!existing) return null;
  const updated: LienWaiver = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  LienWaiverSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((w) => w.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
