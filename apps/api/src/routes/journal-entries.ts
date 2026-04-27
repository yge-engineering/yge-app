// Journal entry routes.

import { Router } from 'express';
import {
  JournalEntryCreateSchema,
  JournalEntryPatchSchema,
  computeAccountBalances,
} from '@yge/shared';
import {
  createJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '../lib/journal-entries-store';

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
