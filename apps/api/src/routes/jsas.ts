// JSA routes.

import { Router } from 'express';
import { JsaCreateSchema, JsaPatchSchema } from '@yge/shared';
import {
  createJsa,
  getJsa,
  listJsas,
  updateJsa,
} from '../lib/jsas-store';

export const jsasRouter = Router();

jsasRouter.get('/', async (req, res, next) => {
  try {
    const jsas = await listJsas({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      workDate: typeof req.query.workDate === 'string' ? req.query.workDate : undefined,
    });
    return res.json({ jsas });
  } catch (err) {
    next(err);
  }
});

jsasRouter.get('/:id', async (req, res, next) => {
  try {
    const j = await getJsa(req.params.id);
    if (!j) return res.status(404).json({ error: 'JSA not found' });
    return res.json({ jsa: j });
  } catch (err) {
    next(err);
  }
});

jsasRouter.post('/', async (req, res, next) => {
  try {
    const parsed = JsaCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const j = await createJsa(parsed.data);
    return res.status(201).json({ jsa: j });
  } catch (err) {
    next(err);
  }
});

jsasRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = JsaPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateJsa(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'JSA not found' });
    return res.json({ jsa: updated });
  } catch (err) {
    next(err);
  }
});
