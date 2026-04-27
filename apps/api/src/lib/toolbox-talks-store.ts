// File-based store for toolbox talks (Cal/OSHA T8 §1509).

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ToolboxTalkSchema,
  newToolboxTalkId,
  type ToolboxTalk,
  type ToolboxTalkCreate,
  type ToolboxTalkPatch,
} from '@yge/shared';

function dataDir(): string {
  return process.env.TOOLBOX_TALKS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'toolbox-talks');
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

async function readIndex(): Promise<ToolboxTalk[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ToolboxTalkSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((t): t is ToolboxTalk => t !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: ToolboxTalk[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createToolboxTalk(input: ToolboxTalkCreate): Promise<ToolboxTalk> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newToolboxTalkId();
  const t: ToolboxTalk = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    attendees: input.attendees ?? [],
    ...input,
  };
  ToolboxTalkSchema.parse(t);
  await fs.writeFile(rowPath(id), JSON.stringify(t, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(t);
  await writeIndex(index);
  return t;
}

export async function listToolboxTalks(filter?: {
  jobId?: string;
  status?: string;
}): Promise<ToolboxTalk[]> {
  let all = await readIndex();
  if (filter?.jobId) all = all.filter((t) => t.jobId === filter.jobId);
  if (filter?.status) all = all.filter((t) => t.status === filter.status);
  all.sort((a, b) => b.heldOn.localeCompare(a.heldOn));
  return all;
}

export async function getToolboxTalk(id: string): Promise<ToolboxTalk | null> {
  if (!/^tbt-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return ToolboxTalkSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateToolboxTalk(
  id: string,
  patch: ToolboxTalkPatch,
): Promise<ToolboxTalk | null> {
  const existing = await getToolboxTalk(id);
  if (!existing) return null;
  const updated: ToolboxTalk = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ToolboxTalkSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((t) => t.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  return updated;
}
