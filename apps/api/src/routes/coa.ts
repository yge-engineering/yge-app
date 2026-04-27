// Chart of Accounts routes.

import { Router } from 'express';
import { AccountCreateSchema, AccountPatchSchema } from '@yge/shared';
import {
  applyDefaultCoaSeed,
  createAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from '../lib/coa-store';

export const coaRouter = Router();

coaRouter.get('/', async (req, res, next) => {
  try {
    const accounts = await listAccounts({
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      active:
        req.query.active === 'true'
          ? true
          : req.query.active === 'false'
            ? false
            : undefined,
    });
    return res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

coaRouter.get('/:id', async (req, res, next) => {
  try {
    const a = await getAccount(req.params.id);
    if (!a) return res.status(404).json({ error: 'Account not found' });
    return res.json({ account: a });
  } catch (err) {
    next(err);
  }
});

coaRouter.post('/', async (req, res, next) => {
  try {
    const parsed = AccountCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const a = await createAccount(parsed.data);
    return res.status(201).json({ account: a });
  } catch (err) {
    next(err);
  }
});

coaRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = AccountPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateAccount(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Account not found' });
    return res.json({ account: updated });
  } catch (err) {
    next(err);
  }
});

/** Idempotent — applies the default seed, skipping numbers that already
 *  exist. Useful for first-time setup or after pruning. */
coaRouter.post('/seed', async (_req, res, next) => {
  try {
    const added = await applyDefaultCoaSeed();
    return res.status(201).json({ added });
  } catch (err) {
    next(err);
  }
});
