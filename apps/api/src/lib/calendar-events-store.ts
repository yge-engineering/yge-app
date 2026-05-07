// Postgres-backed store for calendar events.

import { prisma } from '@yge/db';
import {
  CalendarEventSchema,
  newCalendarEventId,
  eventOverlapsRange,
  type CalendarEvent,
  type CalendarEventCreate,
  type CalendarEventPatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function row2evt(row: { data: unknown }): CalendarEvent {
  return CalendarEventSchema.parse(row.data);
}

interface ListFilter {
  from?: string;
  to?: string;
  category?: string;
  jobId?: string;
}

export async function listCalendarEvents(
  filter: ListFilter = {},
): Promise<CalendarEvent[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { companyId: DEFAULT_COMPANY_ID, deletedAt: null },
    orderBy: { startAt: 'asc' },
  });
  const all = rows.map(row2evt);
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

export async function getCalendarEvent(id: string): Promise<CalendarEvent | null> {
  const row = await prisma.calendarEvent.findFirst({
    where: { id, companyId: DEFAULT_COMPANY_ID, deletedAt: null },
  });
  return row ? row2evt(row) : null;
}

export async function createCalendarEvent(
  input: CalendarEventCreate,
  ctx: AuditContext = { actorUserId: null, reason: null },
): Promise<CalendarEvent> {
  const now = new Date().toISOString();
  const event: CalendarEvent = CalendarEventSchema.parse({
    ...input,
    id: newCalendarEventId(),
    createdAt: now,
    updatedAt: now,
  });
  await prisma.calendarEvent.create({
    data: {
      id: event.id,
      companyId: DEFAULT_COMPANY_ID,
      startAt: event.startAt,
      data: event as unknown as object,
    },
  });
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
  await prisma.calendarEvent.update({
    where: { id },
    data: { startAt: merged.startAt, data: merged as unknown as object },
  });
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
  await prisma.calendarEvent.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
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
