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
import { maybeCsv } from '../lib/csv-response';

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
    if (
      maybeCsv(
        req,
        res,
        tabs,
        [
          { header: 'id', get: (t) => t.id },
          { header: 'source', get: (t) => t.source },
          { header: 'agency', get: (t) => t.agencyName },
          { header: 'ownerType', get: (t) => t.ownerType },
          { header: 'project', get: (t) => t.projectName },
          { header: 'projectNumber', get: (t) => t.projectNumber ?? '' },
          { header: 'county', get: (t) => t.county ?? '' },
          { header: 'state', get: (t) => t.state },
          { header: 'bidOpenedAt', get: (t) => t.bidOpenedAt },
          { header: 'engineersEstimateCents', get: (t) => t.engineersEstimateCents ?? '' },
          { header: 'bidderCount', get: (t) => t.bidders.length },
          {
            header: 'apparentLowName',
            get: (t) => t.bidders.find((b) => b.rank === 1)?.name ?? '',
          },
          {
            header: 'apparentLowCents',
            get: (t) => t.bidders.find((b) => b.rank === 1)?.totalCents ?? '',
          },
          { header: 'awardedToBidderName', get: (t) => t.awardedToBidderName ?? '' },
          { header: 'ygeJobId', get: (t) => t.ygeJobId ?? '' },
          { header: 'ygeBidResultId', get: (t) => t.ygeBidResultId ?? '' },
          { header: 'sourceUrl', get: (t) => t.sourceUrl ?? '' },
          { header: 'scrapedAt', get: (t) => t.scrapedAt },
        ],
        'bid-tabs',
      )
    ) {
      return;
    }
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
