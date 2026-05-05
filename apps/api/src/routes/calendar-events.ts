// Calendar events routes — CRUD for the /calendar screen.
//
// Plain English: list events in a date window, create new ones,
// edit them, delete them. The web's calendar component drives the
// from/to query params off the active view (day/week/month/year).

import { Router } from 'express';
import { z } from 'zod';
import {
  CalendarEventCategorySchema,
  CalendarEventCreateSchema,
  CalendarEventPatchSchema,
} from '@yge/shared';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../lib/calendar-events-store';

export const calendarEventsRouter = Router();

const ListQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: CalendarEventCategorySchema.optional(),
  jobId: z.string().min(1).max(120).optional(),
});

calendarEventsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const events = await listCalendarEvents(parsed.data);
    return res.json({ events });
  } catch (err) {
    next(err);
  }
});

calendarEventsRouter.get('/:id', async (req, res, next) => {
  try {
    const event = await getCalendarEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Calendar event not found' });
    return res.json({ event });
  } catch (err) {
    next(err);
  }
});

calendarEventsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CalendarEventCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const event = await createCalendarEvent(parsed.data);
    return res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

calendarEventsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CalendarEventPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCalendarEvent(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Calendar event not found' });
    return res.json({ event: updated });
  } catch (err) {
    next(err);
  }
});

calendarEventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteCalendarEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Calendar event not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
