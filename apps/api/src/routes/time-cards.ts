// Time card routes.

import { Router } from 'express';
import { TimeCardCreateSchema, TimeCardPatchSchema } from '@yge/shared';
import {
  createTimeCard,
  getTimeCard,
  listTimeCards,
  updateTimeCard,
} from '../lib/time-cards-store';

export const timeCardsRouter = Router();

timeCardsRouter.get('/', async (req, res, next) => {
  try {
    const cards = await listTimeCards({
      employeeId:
        typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
      weekStarting:
        typeof req.query.weekStarting === 'string' ? req.query.weekStarting : undefined,
      status:
        typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ timeCards: cards });
  } catch (err) {
    next(err);
  }
});

timeCardsRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getTimeCard(req.params.id);
    if (!c) return res.status(404).json({ error: 'Time card not found' });
    return res.json({ timeCard: c });
  } catch (err) {
    next(err);
  }
});

timeCardsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = TimeCardCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createTimeCard(parsed.data);
    return res.status(201).json({ timeCard: c });
  } catch (err) {
    next(err);
  }
});

timeCardsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = TimeCardPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateTimeCard(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Time card not found' });
    return res.json({ timeCard: updated });
  } catch (err) {
    next(err);
  }
});
