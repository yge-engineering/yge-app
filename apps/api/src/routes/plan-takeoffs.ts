// Plan takeoffs routes.

import { Router } from 'express';
import { PlanTakeoffCreateSchema, PlanTakeoffPatchSchema } from '@yge/shared';
import {
  createPlanTakeoff,
  getPlanTakeoff,
  listPlanTakeoffs,
  updatePlanTakeoff,
} from '../lib/plan-takeoffs-store';

export const planTakeoffsRouter = Router();

planTakeoffsRouter.get('/', async (req, res, next) => {
  try {
    const takeoffs = await listPlanTakeoffs({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      bidId: typeof req.query.bidId === 'string' ? req.query.bidId : undefined,
      planRef: typeof req.query.planRef === 'string' ? req.query.planRef : undefined,
    });
    return res.json({ takeoffs });
  } catch (err) {
    next(err);
  }
});

planTakeoffsRouter.get('/:id', async (req, res, next) => {
  try {
    const t = await getPlanTakeoff(req.params.id);
    if (!t) return res.status(404).json({ error: 'Plan takeoff not found' });
    return res.json({ takeoff: t });
  } catch (err) {
    next(err);
  }
});

planTakeoffsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PlanTakeoffCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const t = await createPlanTakeoff(parsed.data);
    return res.status(201).json({ takeoff: t });
  } catch (err) {
    next(err);
  }
});

planTakeoffsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PlanTakeoffPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updatePlanTakeoff(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Plan takeoff not found' });
    return res.json({ takeoff: updated });
  } catch (err) {
    next(err);
  }
});
