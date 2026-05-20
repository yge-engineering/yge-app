// Journal entry routes.

import { Router } from 'express';
import { z } from 'zod';
import {
  JournalEntryCreateSchema,
  JournalEntryPatchSchema,
  OPENING_BALANCE_EQUITY_NAME,
  buildQboTrialBalanceImport,
  computeAccountBalances,
  tbRowsFromCsv,
} from '@yge/shared';
import {
  createJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '../lib/journal-entries-store';
import { createAccount, listAccounts } from '../lib/coa-store';

export const journalEntriesRouter = Router();

journalEntriesRouter.get('/', async (req, res, next) => {
  try {
    const entries = await listJournalEntries({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
    });
    return res.json({ entries });
  } catch (err) {
    next(err);
  }
});

/** Trial balance: GET /api/journal-entries/trial-balance — computed
 *  from all POSTED entries. Defined before /:id so the path matcher
 *  doesn't treat it as an entry id. */
journalEntriesRouter.get('/trial-balance', async (_req, res, next) => {
  try {
    const all = await listJournalEntries();
    const balances = computeAccountBalances(all);
    return res.json({ balances });
  } catch (err) {
    next(err);
  }
});

journalEntriesRouter.get('/:id', async (req, res, next) => {
  try {
    const j = await getJournalEntry(req.params.id);
    if (!j) return res.status(404).json({ error: 'Journal entry not found' });
    return res.json({ entry: j });
  } catch (err) {
    next(err);
  }
});

journalEntriesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = JournalEntryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const j = await createJournalEntry(parsed.data);
    return res.status(201).json({ entry: j });
  } catch (err) {
    next(err);
  }
});

journalEntriesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = JournalEntryPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateJournalEntry(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Journal entry not found' });
    return res.json({ entry: updated });
  } catch (err) {
    next(err);
  }
});


/** QuickBooks Online Trial Balance import -> one balanced opening journal
 *  entry. Body: { csv, entryDate, dryRun?, memo?, openingEquityNumber? }.
 *  Dry run (default) previews the entry + match report without writing. On
 *  commit it creates the Opening Balance Equity plug account if needed and
 *  saves the entry as DRAFT — the user reviews and posts it from the journal
 *  entry page (posting to the GL stays a deliberate human action). */
const QboTbImportBody = z.object({
  csv: z.string().min(1).max(5_000_000),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  dryRun: z.boolean().optional(),
  memo: z.string().max(500).optional(),
  openingEquityNumber: z.string().regex(/^\d{4,6}$/).optional(),
});

journalEntriesRouter.post('/import-qbo-trial-balance', async (req, res, next) => {
  try {
    const parsed = QboTbImportBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const { csv, entryDate, dryRun = true, memo, openingEquityNumber } = parsed.data;

    const accounts = await listAccounts();
    const rows = tbRowsFromCsv(csv);
    const result = buildQboTrialBalanceImport(rows, accounts, {
      entryDate,
      ...(memo ? { memo } : {}),
      ...(openingEquityNumber ? { openingEquityNumber } : {}),
    });

    const summary = {
      parsedRows: rows.length,
      lines: result.entry ? result.entry.lines.length : 0,
      matched: result.matched.length,
      unmatched: result.unmatched.length,
      totalDebitCents: result.totalDebitCents,
      totalCreditCents: result.totalCreditCents,
      balanced: result.totalDebitCents === result.totalCreditCents,
      plugNetDebitCents: result.plugNetDebitCents,
      warnings: result.warnings.length,
    };

    if (dryRun) {
      return res.json({ dryRun: true, summary, result });
    }

    if (!result.entry) {
      return res.status(400).json({
        error: 'Nothing to import — no account carried a net balance.',
        result,
      });
    }

    // Ensure every referenced account exists. The only one that can be
    // missing is the Opening Balance Equity plug; create it as equity.
    const haveNumbers = new Set(accounts.map((a) => a.number));
    for (const line of result.entry.lines) {
      if (!haveNumbers.has(line.accountNumber)) {
        await createAccount({
          number: line.accountNumber,
          name: OPENING_BALANCE_EQUITY_NAME,
          type: 'EQUITY',
          active: true,
        });
        haveNumbers.add(line.accountNumber);
      }
    }

    const saved = await createJournalEntry(result.entry);

    return res.status(201).json({
      dryRun: false,
      summary,
      journalEntryId: saved.id,
      status: saved.status,
    });
  } catch (err) {
    next(err);
  }
});
