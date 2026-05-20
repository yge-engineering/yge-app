// Chart of Accounts routes.

import { Router } from 'express';
import { z } from 'zod';
import {
  AccountCreateSchema,
  AccountPatchSchema,
  buildQboCoaImport,
  coaRowsFromCsv,
} from '@yge/shared';
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


/** QuickBooks Online Chart-of-Accounts import.
 *
 *  Body: { csv: string, dryRun?: boolean }. Default is a dry run — it
 *  returns the full plan (accounts to create, accounts that would be
 *  skipped because their number already exists, unmapped rows, warnings)
 *  without touching the database. Send dryRun:false to commit. The commit
 *  is idempotent: any account number that already exists is skipped, so
 *  re-running never duplicates. */
const QboImportBodySchema = z.object({
  csv: z.string().min(1).max(5_000_000),
  dryRun: z.boolean().optional(),
});

coaRouter.post('/import-qbo', async (req, res, next) => {
  try {
    const parsed = QboImportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { csv, dryRun = true } = parsed.data;

    const rows = coaRowsFromCsv(csv);
    const plan = buildQboCoaImport(rows);

    const existing = await listAccounts();
    const haveNumbers = new Set(existing.map((a) => a.number));

    const toCreate = plan.accounts.filter((a) => !haveNumbers.has(a.number));
    const skipped = plan.accounts.filter((a) => haveNumbers.has(a.number));

    const summary = {
      parsedRows: rows.length,
      mapped: plan.accounts.length,
      willCreate: toCreate.length,
      willSkip: skipped.length,
      unmapped: plan.unmapped.length,
      warnings: plan.warnings.length,
    };

    if (dryRun) {
      return res.json({
        dryRun: true,
        summary,
        plan,
        skipped: skipped.map((a) => ({ number: a.number, name: a.name })),
      });
    }

    const created: Array<{ number: string; name: string; type: string }> = [];
    for (const a of toCreate) {
      const { sourceFullName: _sourceFullName, ...accountCreate } = a;
      void _sourceFullName;
      const acc = await createAccount(accountCreate);
      created.push({ number: acc.number, name: acc.name, type: acc.type });
    }

    return res.status(201).json({
      dryRun: false,
      summary: { ...summary, created: created.length },
      created,
      skipped: skipped.map((a) => ({ number: a.number, name: a.name })),
      unmapped: plan.unmapped,
      warnings: plan.warnings,
    });
  } catch (err) {
    next(err);
  }
});
