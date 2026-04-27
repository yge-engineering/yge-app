// SWPPP inspection routes.

import { Router } from 'express';
import {
  SwpppInspectionCreateSchema,
  SwpppInspectionPatchSchema,
} from '@yge/shared';
import {
  createSwpppInspection,
  getSwpppInspection,
  listSwpppInspections,
  updateSwpppInspection,
} from '../lib/swppp-inspections-store';

export const swpppInspectionsRouter = Router();

swpppInspectionsRouter.get('/', async (req, res, next) => {
  try {
    const inspections = await listSwpppInspections({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ inspections });
  } catch (err) {
    next(err);
  }
});

swpppInspectionsRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await getSwpppInspection(req.params.id);
    if (!s) return res.status(404).json({ error: 'SWPPP inspection not found' });
    return res.json({ inspection: s });
  } catch (err) {
    next(err);
  }
});

swpppInspectionsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = SwpppInspectionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const s = await createSwpppInspection(parsed.data);
    return res.status(201).json({ inspection: s });
  } catch (err) {
    next(err);
  }
});

swpppInspectionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = SwpppInspectionPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateSwpppInspection(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'SWPPP inspection not found' });
    return res.json({ inspection: updated });
  } catch (err) {
    next(err);
  }
});
