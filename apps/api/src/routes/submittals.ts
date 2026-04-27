// Submittal routes.

import { Router } from 'express';
import { SubmittalCreateSchema, SubmittalPatchSchema } from '@yge/shared';
import {
  createSubmittal,
  getSubmittal,
  listSubmittals,
  updateSubmittal,
} from '../lib/submittals-store';

export const submittalsRouter = Router();

submittalsRouter.get('/', async (req, res, next) => {
  try {
    const submittals = await listSubmittals({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ submittals });
  } catch (err) {
    next(err);
  }
});

submittalsRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await getSubmittal(req.params.id);
    if (!s) return res.status(404).json({ error: 'Submittal not found' });
    return res.json({ submittal: s });
  } catch (err) {
    next(err);
  }
});

submittalsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = SubmittalCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const s = await createSubmittal(parsed.data);
    return res.status(201).json({ submittal: s });
  } catch (err) {
    next(err);
  }
});

submittalsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = SubmittalPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateSubmittal(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Submittal not found' });
    return res.json({ submittal: updated });
  } catch (err) {
    next(err);
  }
});
