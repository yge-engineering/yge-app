// Legal-hold routes — list / get / create / release.

import { Router } from 'express';
import { z } from 'zod';
import {
  LegalHoldCreateSchema,
  LegalHoldStatusSchema,
} from '@yge/shared';
import {
  createLegalHold,
  getLegalHold,
  listLegalHolds,
  releaseLegalHold,
} from '../lib/legal-holds-store';

export const legalHoldsRouter = Router();

const ListQuerySchema = z.object({
  status: LegalHoldStatusSchema.optional(),
});

legalHoldsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const holds = await listLegalHolds(parsed.data);
    holds.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return res.json({ holds });
  } catch (err) { next(err); }
});

legalHoldsRouter.get('/:id', async (req, res, next) => {
  try {
    const hold = await getLegalHold(req.params.id);
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    return res.json({ hold });
  } catch (err) { next(err); }
});

legalHoldsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = LegalHoldCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const hold = await createLegalHold(parsed.data);
    return res.status(201).json({ hold });
  } catch (err) { next(err); }
});

const ReleaseSchema = z.object({
  releasedByUserId: z.string().min(1).max(120).optional(),
  releasedReason: z.string().min(1).max(2000),
});

legalHoldsRouter.post('/:id/release', async (req, res, next) => {
  try {
    const parsed = ReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const hold = await releaseLegalHold(
      req.params.id,
      parsed.data.releasedByUserId ?? null,
      parsed.data.releasedReason,
    );
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    return res.json({ hold });
  } catch (err) { next(err); }
});
