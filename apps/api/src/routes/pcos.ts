// PCO routes.

import { Router } from 'express';
import { PcoCreateSchema, PcoPatchSchema } from '@yge/shared';
import {
  createPco,
  getPco,
  listPcos,
  updatePco,
} from '../lib/pcos-store';

export const pcosRouter = Router();

pcosRouter.get('/', async (req, res, next) => {
  try {
    const pcos = await listPcos({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ pcos });
  } catch (err) {
    next(err);
  }
});

pcosRouter.get('/:id', async (req, res, next) => {
  try {
    const p = await getPco(req.params.id);
    if (!p) return res.status(404).json({ error: 'PCO not found' });
    return res.json({ pco: p });
  } catch (err) {
    next(err);
  }
});

pcosRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PcoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const p = await createPco(parsed.data);
    return res.status(201).json({ pco: p });
  } catch (err) {
    next(err);
  }
});

pcosRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PcoPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updatePco(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'PCO not found' });
    return res.json({ pco: updated });
  } catch (err) {
    next(err);
  }
});
