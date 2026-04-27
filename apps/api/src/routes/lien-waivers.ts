// Lien waiver routes.

import { Router } from 'express';
import { LienWaiverCreateSchema, LienWaiverPatchSchema } from '@yge/shared';
import {
  createLienWaiver,
  getLienWaiver,
  listLienWaivers,
  updateLienWaiver,
} from '../lib/lien-waivers-store';

export const lienWaiversRouter = Router();

lienWaiversRouter.get('/', async (req, res, next) => {
  try {
    const waivers = await listLienWaivers({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ waivers });
  } catch (err) {
    next(err);
  }
});

lienWaiversRouter.get('/:id', async (req, res, next) => {
  try {
    const w = await getLienWaiver(req.params.id);
    if (!w) return res.status(404).json({ error: 'Lien waiver not found' });
    return res.json({ waiver: w });
  } catch (err) {
    next(err);
  }
});

lienWaiversRouter.post('/', async (req, res, next) => {
  try {
    const parsed = LienWaiverCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const w = await createLienWaiver(parsed.data);
    return res.status(201).json({ waiver: w });
  } catch (err) {
    next(err);
  }
});

lienWaiversRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = LienWaiverPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateLienWaiver(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Lien waiver not found' });
    return res.json({ waiver: updated });
  } catch (err) {
    next(err);
  }
});
