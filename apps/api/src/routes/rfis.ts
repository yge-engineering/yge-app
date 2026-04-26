// RFI routes.

import { Router } from 'express';
import { RfiCreateSchema, RfiPatchSchema } from '@yge/shared';
import {
  createRfi,
  getRfi,
  listRfis,
  updateRfi,
} from '../lib/rfis-store';

export const rfisRouter = Router();

rfisRouter.get('/', async (req, res, next) => {
  try {
    const rfis = await listRfis({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ rfis });
  } catch (err) {
    next(err);
  }
});

rfisRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getRfi(req.params.id);
    if (!r) return res.status(404).json({ error: 'RFI not found' });
    return res.json({ rfi: r });
  } catch (err) {
    next(err);
  }
});

rfisRouter.post('/', async (req, res, next) => {
  try {
    const parsed = RfiCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createRfi(parsed.data);
    return res.status(201).json({ rfi: r });
  } catch (err) {
    next(err);
  }
});

rfisRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = RfiPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateRfi(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'RFI not found' });
    return res.json({ rfi: updated });
  } catch (err) {
    next(err);
  }
});
