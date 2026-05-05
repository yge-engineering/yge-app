// Cost codes master routes — CRUD for the master reference list.

import { Router } from 'express';
import { CostCodeCreateSchema, CostCodePatchSchema } from '@yge/shared';
import {
  createCostCode,
  deleteCostCode,
  getCostCode,
  listCostCodes,
  updateCostCode,
} from '../lib/cost-codes-store';

export const costCodesRouter = Router();

costCodesRouter.get('/', async (_req, res, next) => {
  try {
    const costCodes = await listCostCodes();
    return res.json({ costCodes });
  } catch (err) { next(err); }
});

costCodesRouter.get('/:id', async (req, res, next) => {
  try {
    const cc = await getCostCode(req.params.id);
    if (!cc) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ costCode: cc });
  } catch (err) { next(err); }
});

costCodesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CostCodeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const cc = await createCostCode(parsed.data);
    return res.status(201).json({ costCode: cc });
  } catch (err) { next(err); }
});

costCodesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CostCodePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCostCode(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ costCode: updated });
  } catch (err) { next(err); }
});

costCodesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteCostCode(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Cost code not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});
