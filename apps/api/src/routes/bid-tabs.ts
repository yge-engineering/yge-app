// Bid-tab routes — list / get / create / delete.

import { Router } from 'express';
import { z } from 'zod';
import {
  BidTabCreateSchema,
  BidTabSourceSchema,
} from '@yge/shared';
import {
  createBidTab,
  deleteBidTab,
  getBidTab,
  listBidTabs,
} from '../lib/bid-tabs-store';

export const bidTabsRouter = Router();

const ListQuerySchema = z.object({
  source: BidTabSourceSchema.optional(),
  county: z.string().max(80).optional(),
  ygeJobId: z.string().max(120).optional(),
  search: z.string().max(200).optional(),
});

bidTabsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const tabs = await listBidTabs(parsed.data);
    return res.json({ tabs });
  } catch (err) { next(err); }
});

bidTabsRouter.get('/:id', async (req, res, next) => {
  try {
    const tab = await getBidTab(req.params.id);
    if (!tab) return res.status(404).json({ error: 'Bid tab not found' });
    return res.json({ tab });
  } catch (err) { next(err); }
});

bidTabsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = BidTabCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const tab = await createBidTab(parsed.data);
    return res.status(201).json({ tab });
  } catch (err) { next(err); }
});

bidTabsRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteBidTab(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Bid tab not found' });
    return res.status(204).end();
  } catch (err) { next(err); }
});
