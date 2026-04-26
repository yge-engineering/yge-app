// File-based store for power tools.
//
// Phase 1 stand-in for the future Postgres `Tool` table. The dispatch
// helpers (assignTool / returnTool) keep status + assignedToEmployeeId +
// assignedAt in lockstep so the UI never sees a half-state row.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  ToolSchema,
  newToolId,
  type Tool,
  type ToolCreate,
  type ToolPatch,
} from '@yge/shared';

function dataDir(): string {
  return (
    process.env.TOOLS_DATA_DIR ?? path.resolve(process.cwd(), 'data', 'tools')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function toolPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Tool[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = ToolSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((t): t is Tool => t !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Tool[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createTool(input: ToolCreate): Promise<Tool> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newToolId();
  const t: Tool = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'IN_YARD',
    ...input,
  };
  ToolSchema.parse(t);
  await fs.writeFile(toolPath(id), JSON.stringify(t, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(t);
  await writeIndex(index);
  return t;
}

export async function listTools(): Promise<Tool[]> {
  return readIndex();
}

export async function getTool(id: string): Promise<Tool | null> {
  if (!/^tool-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(toolPath(id), 'utf8');
    return ToolSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateTool(
  id: string,
  patch: ToolPatch,
): Promise<Tool | null> {
  const existing = await getTool(id);
  if (!existing) return null;
  const updated: Tool = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  ToolSchema.parse(updated);
  await fs.writeFile(toolPath(id), JSON.stringify(updated, null, 2), 'utf8');
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

/** Dispatch a tool out to an employee. Sets status=ASSIGNED + records the
 *  assignment time so the UI can show "out for N days". */
export async function assignTool(
  id: string,
  assignedToEmployeeId: string,
): Promise<Tool | null> {
  return updateTool(id, {
    status: 'ASSIGNED',
    assignedToEmployeeId,
    assignedAt: new Date().toISOString(),
  });
}

/** Return a tool to the yard. Clears the assignee + assigned-at and sets
 *  status=IN_YARD. The caller can override the destination status to
 *  IN_SHOP / OUT_FOR_REPAIR if the tool needs work. */
export async function returnTool(
  id: string,
  destination: 'IN_YARD' | 'IN_SHOP' | 'OUT_FOR_REPAIR' = 'IN_YARD',
): Promise<Tool | null> {
  return updateTool(id, {
    status: destination,
    assignedToEmployeeId: undefined,
    assignedAt: undefined,
  });
}
