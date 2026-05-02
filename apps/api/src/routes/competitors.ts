// Competitors route — derived rollup from the bid-tab corpus.
//
// No persistence layer — rollup recomputes on each request from
// the bid-tabs store. The route exists so the web page can fetch
// the rollup directly (consistent with all the other endpoints)
// and so the rollup is exportable as CSV via ?format=csv.

import { Router } from 'express';
import { z } from 'zod';
import { buildCompetitorProfilesFromTabs } from '@yge/shared';
import { listBidTabs } from '../lib/bid-tabs-store';
import { maybeCsv } from '../lib/csv-response';

export const competitorsRouter = Router();

const ListQuerySchema = z.object({
  /** Number of days back to consider. Omit for all-time. */
  days: z.coerce.number().int().positive().max(36500).optional(),
  /** Minimum appearances to surface. Default 1. */
  minAppearances: z.coerce.number().int().nonnegative().max(100).optional(),
});

competitorsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const allTabs = await listBidTabs();
    let tabs = allTabs;
    if (parsed.data.days) {
      const cutoff = Date.now() - parsed.data.days * 24 * 60 * 60 * 1000;
      tabs = allTabs.filter((t) => {
        const ts = Date.parse(`${t.bidOpenedAt.slice(0, 10)}T00:00:00Z`);
        return Number.isFinite(ts) && ts >= cutoff;
      });
    }
    const result = buildCompetitorProfilesFromTabs(tabs, parsed.data.minAppearances ?? 1);
    if (
      maybeCsv(
        req,
        res,
        result.rows,
        [
          { header: 'nameNormalized', get: (r) => r.nameNormalized },
          { header: 'displayName', get: (r) => r.displayName },
          { header: 'appearances', get: (r) => r.appearances },
          { header: 'apparentLowCount', get: (r) => r.apparentLowCount },
          { header: 'awardCount', get: (r) => r.awardCount },
          { header: 'avgBidCents', get: (r) => r.avgBidCents },
          { header: 'minBidCents', get: (r) => r.minBidCents },
          { header: 'maxBidCents', get: (r) => r.maxBidCents },
          { header: 'avgRank', get: (r) => r.avgRank.toFixed(2) },
          {
            header: 'topAgency',
            get: (r) => r.topAgencies[0]?.agencyName ?? '',
          },
          {
            header: 'topAgencyCount',
            get: (r) => r.topAgencies[0]?.count ?? '',
          },
          {
            header: 'counties',
            get: (r) => r.topCounties.map((c) => c.county).join(' / '),
          },
          { header: 'firstSeenAt', get: (r) => r.firstSeenAt },
          { header: 'lastSeenAt', get: (r) => r.lastSeenAt },
          { header: 'everDbe', get: (r) => (r.everDbe ? 'true' : '') },
          { header: 'everSbe', get: (r) => (r.everSbe ? 'true' : '') },
          { header: 'everWithdrawn', get: (r) => (r.everWithdrawn ? 'true' : '') },
          { header: 'everRejected', get: (r) => (r.everRejected ? 'true' : '') },
          { header: 'cslbLicense', get: (r) => r.cslbLicense ?? '' },
          { header: 'dirRegistration', get: (r) => r.dirRegistration ?? '' },
        ],
        'competitors',
      )
    ) {
      return;
    }
    return res.json({ rollup: result.rollup, rows: result.rows });
  } catch (err) { next(err); }
});
