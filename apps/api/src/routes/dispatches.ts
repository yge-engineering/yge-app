// Dispatch routes.

import { Router } from 'express';
import { DispatchCreateSchema, DispatchPatchSchema } from '@yge/shared';
import {
  createDispatch,
  getDispatch,
  listDispatches,
  updateDispatch,
} from '../lib/dispatches-store';

export const dispatchesRouter = Router();

dispatchesRouter.get('/', async (req, res, next) => {
  try {
    const dispatches = await listDispatches({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      scheduledFor:
        typeof req.query.scheduledFor === 'string' ? req.query.scheduledFor : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
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
