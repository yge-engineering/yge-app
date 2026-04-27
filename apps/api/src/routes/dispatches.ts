// Dispatch routes.

import { Router } from 'express';
import {
  DispatchCreateSchema,
  DispatchPatchSchema,
  dispatchStatusLabel,
  type Dispatch,
} from '@yge/shared';
import {
  createDispatch,
  getDispatch,
  listDispatches,
  updateDispatch,
} from '../lib/dispatches-store';
import { maybeCsv } from '../lib/csv-response';

export const dispatchesRouter = Router();

const DISPATCH_CSV_COLUMNS = [
  { header: 'Date', get: (d: Dispatch) => d.scheduledFor },
  { header: 'Job', get: (d: Dispatch) => d.jobId },
  { header: 'Foreman', get: (d: Dispatch) => d.foremanName },
  { header: 'Foreman phone', get: (d: Dispatch) => d.foremanPhone ?? '' },
  { header: 'Meet time', get: (d: Dispatch) => d.meetTime ?? '' },
  { header: 'Meet location', get: (d: Dispatch) => d.meetLocation ?? '' },
  { header: 'Crew count', get: (d: Dispatch) => d.crew.length },
  {
    header: 'Crew',
    get: (d: Dispatch) => d.crew.map((c) => c.name).join('; '),
  },
  { header: 'Equipment count', get: (d: Dispatch) => d.equipment.length },
  {
    header: 'Equipment',
    get: (d: Dispatch) => d.equipment.map((e) => e.name).join('; '),
  },
  { header: 'Status', get: (d: Dispatch) => dispatchStatusLabel(d.status) },
  { header: 'Scope', get: (d: Dispatch) => d.scopeOfWork },
] as const;

dispatchesRouter.get('/', async (req, res, next) => {
  try {
    const dispatches = await listDispatches({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      scheduledFor:
        typeof req.query.scheduledFor === 'string' ? req.query.scheduledFor : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    if (maybeCsv(req, res, dispatches, DISPATCH_CSV_COLUMNS, 'dispatches')) return;
    return res.json({ dispatches });
  } catch (err) {
    next(err);
  }
});

dispatchesRouter.get('/:id', async (req, res, next) => {
  try {
    const d = await getDispatch(req.params.id);
    if (!d) return res.status(404).json({ error: 'Dispatch not found' });
    return res.json({ dispatch: d });
  } catch (err) {
    next(err);
  }
});

dispatchesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = DispatchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const d = await createDispatch(parsed.data);
    return res.status(201).json({ dispatch: d });
  } catch (err) {
    next(err);
  }
});

dispatchesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = DispatchPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateDispatch(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Dispatch not found' });
    return res.json({ dispatch: updated });
  } catch (err) {
    next(err);
  }
});
