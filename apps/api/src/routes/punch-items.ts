// Punch list routes.

import { Router } from 'express';
import { PunchItemCreateSchema, PunchItemPatchSchema } from '@yge/shared';
import {
  createPunchItem,
  getPunchItem,
  listPunchItems,
  updatePunchItem,
} from '../lib/punch-items-store';

export const punchItemsRouter = Router();

punchItemsRouter.get('/', async (req, res, next) => {
  try {
    const items = await listPunchItems({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ items });
  } catch (err) {
    next(err);
  }
});

punchItemsRouter.get('/:id', async (req, res, next) => {
  try {
    const p = await getPunchItem(req.params.id);
    if (!p) return res.status(404).json({ error: 'Punch item not found' });
    return res.json({ item: p });
  } catch (err) {
    next(err);
  }
});

punchItemsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PunchItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const p = await createPunchItem(parsed.data);
    return res.status(201).json({ item: p });
  } catch (err) {
    next(err);
  }
});

punchItemsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PunchItemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updatePunchItem(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Punch item not found' });
    return res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});
