// Labor rates router — full CRUD for the labor rate book.
//
// GET    /api/labor-rates              list rates (optional activeOn filter)
// GET    /api/labor-rates/:id          single rate
// POST   /api/labor-rates              create a rate
// PATCH  /api/labor-rates/:id          partial update
// DELETE /api/labor-rates/:id          soft delete (sets deletedAt)
//
// All mutations are audit-logged. Permission gating happens at the
// page level via requirePermission('financials:edit') — the API
// itself trusts the tenant middleware for now (multi-tenant gate
// upgrade lands with the auth wire-up).

import { Router } from 'express';
import {
  LaborRateCreateSchema,
  LaborRatePatchSchema,
} from '@yge/shared';
import {
  createLaborRate,
  deleteLaborRate,
  getLaborRate,
  listLaborRates,
  updateLaborRate,
} from '../lib/labor-rates-store';

export const laborRatesRouter = Router();

laborRatesRouter.get('/', async (req, res, next) => {
  try {
    const activeOn =
      typeof req.query.activeOn === 'string' ? req.query.activeOn : undefined;
    const includeDeleted = req.query.includeDeleted === '1';
    const rates = await listLaborRates({ activeOn, includeDeleted });
    return res.json({ laborRates: rates });
  } catch (err) {
    next(err);
  }
});

laborRatesRouter.get('/:id', async (req, res, next) => {
  try {
    const rate = await getLaborRate(req.params.id);
    if (!rate) return res.status(404).json({ error: 'Labor rate not found' });
    return res.json({ laborRate: rate });
  } catch (err) {
    next(err);
  }
});

laborRatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = LaborRateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const rate = await createLaborRate(parsed.data);
    return res.status(201).json({ laborRate: rate });
  } catch (err) {
    next(err);
  }
});

laborRatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = LaborRatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const rate = await updateLaborRate(req.params.id, parsed.data);
    if (!rate) return res.status(404).json({ error: 'Labor rate not found' });
    return res.json({ laborRate: rate });
  } catch (err) {
    next(err);
  }
});

laborRatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteLaborRate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Labor rate not found' });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});
