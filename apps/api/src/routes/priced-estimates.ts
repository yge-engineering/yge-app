// Priced estimate routes — file-backed Phase 1 stand-in.
//
// Lives at /api/priced-estimates while the Prisma-backed /api/estimates is
// stubbed out. When the Estimate / BidItem schema lands in Postgres, this
// file goes away and /api/estimates absorbs the surface.

import { Router } from 'express';
import { z } from 'zod';
import {
  AddendumSchema,
  BidSecuritySchema,
  PricedBidItemSchema,
  SubBidSchema,
  computeEstimateTotals,
  pricedEstimateToCsv,
} from '@yge/shared';
import { getDraft } from '../lib/drafts-store';
import {
  createFromDraft,
  getEstimate,
  listEstimates,
  setLineUnitPrice,
  updateEstimate,
} from '../lib/estimates-store';

export const pricedEstimatesRouter = Router();

const FromDraftBody = z.object({
  fromDraftId: z.string().min(1),
  /** Optional override for the default 20% O&P. */
  oppPercent: z.number().min(0).max(2).optional(),
});

// POST /api/priced-estimates/from-draft — create an editable estimate from a
// saved Plans-to-Estimate draft.
pricedEstimatesRouter.post('/from-draft', async (req, res, next) => {
  try {
    const parsed = FromDraftBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const draft = await getDraft(parsed.data.fromDraftId);
    if (!draft) {
      return res.status(404).json({ error: 'Source draft not found' });
    }
    const estimate = await createFromDraft({
      fromDraftId: draft.id,
      jobId: draft.jobId,
      draft: draft.draft,
      oppPercent: parsed.data.oppPercent,
    });
    return res.status(201).json({ estimate });
  } catch (err) {
    next(err);
  }
});

// GET /api/priced-estimates — newest-first summary list.
pricedEstimatesRouter.get('/', async (_req, res, next) => {
  try {
    const estimates = await listEstimates();
    return res.json({ estimates });
  } catch (err) {
    next(err);
  }
});

// GET /api/priced-estimates/:id — full estimate plus computed totals.
pricedEstimatesRouter.get('/:id', async (req, res, next) => {
  try {
    const estimate = await getEstimate(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    return res.json({
      estimate,
      totals: computeEstimateTotals(estimate),
    });
  } catch (err) {
    next(err);
  }
});

const UpdateBody = z.object({
  oppPercent: z.number().min(0).max(2).optional(),
  notes: z.string().max(5_000).optional(),
  bidItems: z.array(PricedBidItemSchema).min(1).optional(),
  subBids: z.array(SubBidSchema).optional(),
  /** Pass null to clear bid security (e.g. switching to private work). */
  bidSecurity: BidSecuritySchema.nullable().optional(),
  /** Replace the full addendum list. The addendum editor PATCHes through
   *  the estimate-level endpoint on every commit. */
  addenda: z.array(AddendumSchema).optional(),
});

// PATCH /api/priced-estimates/:id — update O&P / notes / full bid item list.
pricedEstimatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEstimate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Estimate not found' });
    return res.json({
      estimate: updated,
      totals: computeEstimateTotals(updated),
    });
  } catch (err) {
    next(err);
  }
});

const LinePriceBody = z.object({
  unitPriceCents: z.number().int().nonnegative().nullable(),
});

// GET /api/priced-estimates/:id/export.csv — full priced estimate CSV
// including the totals block. Same bytes as the in-page Download button.
pricedEstimatesRouter.get('/:id/export.csv', async (req, res, next) => {
  try {
    const estimate = await getEstimate(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });

    const csv = pricedEstimateToCsv(estimate);
    const slug = estimate.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'priced-estimate';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-priced-estimate.csv"`,
    );
    return res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

const SubBidsBody = z.object({
  subBids: z.array(SubBidSchema),
});

// PUT /api/priced-estimates/:id/sub-bids — replace the whole subcontractor
// list. PUT (not PATCH) because we replace the array wholesale; bidding the
// whole list keeps the on-disk shape consistent and avoids reorder races.
pricedEstimatesRouter.put('/:id/sub-bids', async (req, res, next) => {
  try {
    const parsed = SubBidsBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEstimate(req.params.id, {
      subBids: parsed.data.subBids,
    });
    if (!updated) return res.status(404).json({ error: 'Estimate not found' });
    return res.json({
      estimate: updated,
      totals: computeEstimateTotals(updated),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/priced-estimates/:id/items/:itemIndex — set one line's price.
// Used by the inline editor so the wire payload stays small.
pricedEstimatesRouter.patch('/:id/items/:itemIndex', async (req, res, next) => {
  try {
    const itemIndex = Number(req.params.itemIndex);
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return res.status(400).json({ error: 'Bad item index' });
    }
    const parsed = LinePriceBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await setLineUnitPrice(
      req.params.id,
      itemIndex,
      parsed.data.unitPriceCents,
    );
    if (!updated) {
      return res.status(404).json({ error: 'Estimate or item not found' });
    }
    return res.json({
      estimate: updated,
      totals: computeEstimateTotals(updated),
    });
  } catch (err) {
    next(err);
  }
});
