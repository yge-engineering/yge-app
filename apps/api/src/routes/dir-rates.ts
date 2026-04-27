// DIR prevailing wage rate routes.

import { Router } from 'express';
import { DirRateCreateSchema, DirRatePatchSchema } from '@yge/shared';
import {
  createDirRate,
  getDirRate,
  listDirRates,
  updateDirRate,
} from '../lib/dir-rates-store';

export const dirRatesRouter = Router();

dirRatesRouter.get('/', async (req, res, next) => {
  try {
    const rates = await listDirRates({
      classification:
        typeof req.query.classification === 'string' ? req.query.classification : undefined,
      county: typeof req.query.county === 'string' ? req.query.county : undefined,
    });
    return res.json({ rates });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getDirRate(req.params.id);
    if (!r) return res.status(404).json({ error: 'DIR rate not found' });
    return res.json({ rate: r });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = DirRateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createDirRate(parsed.data);
    return res.status(201).json({ rate: r });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = DirRatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateDirRate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'DIR rate not found' });
    return res.json({ rate: updated });
  } catch (err) {
    next(err);
  }
});
