// Calendar events store — file-backed CRUD.
//
// Plain English: meetings, bid deadlines, payroll cutoffs, etc.
// One JSON file per row plus an index.json for fast list-with-range
// queries. Same pattern as dispatches-store.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CalendarEventSchema,
  newCalendarEventId,
  eventOverlapsRange,
  type CalendarEvent,
  type CalendarEventCreate,
  type CalendarEventPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.CALENDAR_EVENTS_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'calendar-events')
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

async function readIndex(): Promise<CalendarEvent[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = CalendarEventSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((e): e is CalendarEvent => e !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: CalendarEvent[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

interface ListFilter {
  /** yyyy-mm-dd (inclusive). */
  from?: string;
  /** yyyy-mm-dd (inclusive). */
  to?: string;
  /** Filter by category. */
  category?: string;
  /** Filter by linked job. */
  jobId?: string;
}

export async function listCalendarEvents(
  filter: ListFilter = {},
): Promise<CalendarEvent[]> {
  await ensureDir();
  const all = await readIndex();
  return all
    .filter((e) => {
      if (filter.from && filter.to) {
        if (!eventOverlapsRange(e, filter.from, filter.to)) return false;
      } else if (filter.from && e.endAt.slice(0, 10) < filter.from) {
        return false;
      } else if (filter.to && e.startAt.slice(0, 10) > filter.to) {
        return false;
      }
      if (filter.category && e.category !== filter.category) return false;
      if (filter.jobId && e.jobId !== filter.jobId) return false;
      return true;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function getCalendarEvent(
  id: string,
): Promise<CalendarEvent | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    const parsed = CalendarEventSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createCalendarEvent(
  input: CalendarEventCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CalendarEvent> {
  await ensureDir();
  const now = new Date().toISOString();
  const event: CalendarEvent = CalendarEventSchema.parse({
    ...input,
    id: newCalendarEventId(),
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(rowPath(event.id), JSON.stringify(event, null, 2), 'utf8');
  const idx = await readIndex();
  idx.push(event);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'CalendarEvent',
    entityId: event.id,
    action: 'create',
    before: null,
    after: event,
    ctx,
  });
  return event;
}

export async function updateCalendarEvent(
  id: string,
  patch: CalendarEventPatch,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CalendarEvent | null> {
  const existing = await getCalendarEvent(id);
  if (!existing) return null;
  const merged: CalendarEvent = CalendarEventSchema.parse({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await fs.writeFile(rowPath(id), JSON.stringify(merged, null, 2), 'utf8');
  const idx = await readIndex();
  const i = idx.findIndex((e) => e.id === id);
  if (i >= 0) idx[i] = merged;
  else idx.push(merged);
  await writeIndex(idx);
  await recordAudit({
    entityType: 'CalendarEvent',
    entityId: id,
    action: 'update',
    before: existing,
    after: merged,
    ctx,
  });
  return merged;
}

export async function deleteCalendarEvent(
  id: string,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<boolean> {
  const existing = await getCalendarEvent(id);
  if (!existing) return false;
  await fs.unlink(rowPath(id)).catch(() => undefined);
  const idx = await readIndex();
  const next = idx.filter((e) => e.id !== id);
  await writeIndex(next);
  await recordAudit({
    entityType: 'CalendarEvent',
    entityId: id,
    action: 'delete',
    before: existing,
    after: null,
    ctx,
  });
  return true;
}
