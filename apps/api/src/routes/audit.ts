// Audit-event routes — read-only.
//
// The audit log is append-only by design (the recordAudit helper
// writes; nothing here mutates). These routes power:
//   - /audit web screen (global review with filters)
//   - the per-record binder panel on every detail page
//     (?entityType=ApInvoice&entityId=ap-12345678)
//
// Filters mirror the AuditFilter shape from @yge/shared.

import { Router } from 'express';
import {
  AuditActionSchema,
  AuditEntityTypeSchema,
  changedFields,
  type AuditEvent,
} from '@yge/shared';
import { z } from 'zod';
import { getAuditEvent, listAuditEvents } from '../lib/audit-store';

export const auditRouter = Router();

const ListQuerySchema = z.object({
  companyId: z.string().min(1).max(120).optional(),
  actorUserId: z.string().min(1).max(120).optional(),
  entityType: AuditEntityTypeSchema.optional(),
  entityId: z.string().min(1).max(120).optional(),
  action: AuditActionSchema.optional(),
  /** Inclusive yyyy-mm-dd window applied to createdAt. */
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Paging caps the response size for the UI. Defaults to 200 —
   *  enough for the binder panel + the `/audit` first page. */
  limit: z.coerce.number().int().positive().max(2000).optional(),
});

// GET /api/audit-events — newest-first list with filters.
auditRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { limit, ...filter } = parsed.data;
    const all = await listAuditEvents(filter);
    // listAuditEvents already returns newest-first because rows are
    // unshifted into the index; trim to limit.
    const events = all.slice(0, limit ?? 200);
    return res.json({ events, total: all.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/audit-events/export.csv — same filters as the list,
// streams a CSV with one row per event. Useful for compliance
// reviews + occasional data exports for the CPA / bonding agent.
auditRouter.get('/export.csv', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { limit, ...filter } = parsed.data;
    const all = await listAuditEvents(filter);
    const rows = all.slice(0, limit ?? 10_000);

    const header = [
      'id',
      'createdAt',
      'companyId',
      'actorUserId',
      'action',
      'entityType',
      'entityId',
      'changedFields',
      'reason',
      'ipAddress',
    ];
    const csvLines: string[] = [header.join(',')];
    for (const e of rows) {
      csvLines.push(eventToCsvRow(e));
    }
    const body = '﻿' + csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const datestamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="yge-audit-${datestamp}.csv"`,
    );
    return res.send(body);
  } catch (err) {
    next(err);
  }
});

function csvCell(s: unknown): string {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function eventToCsvRow(e: AuditEvent): string {
  const fields = changedFields(e.before, e.after);
  return [
    csvCell(e.id),
    csvCell(e.createdAt),
    csvCell(e.companyId),
    csvCell(e.actorUserId ?? ''),
    csvCell(e.action),
    csvCell(e.entityType),
    csvCell(e.entityId),
    csvCell(fields.join(' | ')),
    csvCell(e.reason ?? ''),
    csvCell(e.ipAddress ?? ''),
  ].join(',');
}

// GET /api/audit-events/:id — one event with full before/after.
auditRouter.get('/:id', async (req, res, next) => {
  try {
    const event = await getAuditEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Audit event not found' });
    return res.json({ event });
  } catch (err) {
    next(err);
  }
});
