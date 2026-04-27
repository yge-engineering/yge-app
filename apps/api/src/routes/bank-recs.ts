// Bank reconciliation routes.

import { Router } from 'express';
import { BankRecCreateSchema, BankRecPatchSchema } from '@yge/shared';
import {
  createBankRec,
  getBankRec,
  listBankRecs,
  updateBankRec,
} from '../lib/bank-recs-store';

export const bankRecsRouter = Router();

bankRecsRouter.get('/', async (req, res, next) => {
  try {
    const recs = await listBankRecs({
      bankAccountLabel:
        typeof req.query.bankAccountLabel === 'string'
          ? req.query.bankAccountLabel
          : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ recs });
  } catch (err) {
    next(err);
  }
});

bankRecsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getBankRec(req.params.id);
    if (!r) return res.status(404).json({ error: 'Bank rec not found' });
    return res.json({ rec: r });
  } catch (err) {
    next(err);
  }
});

bankRecsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = BankRecCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createBankRec(parsed.data);
    return res.status(201).json({ rec: r });
  } catch (err) {
    next(err);
  }
});

bankRecsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = BankRecPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateBankRec(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Bank rec not found' });
    return res.json({ rec: updated });
  } catch (err) {
    next(err);
  }
});
