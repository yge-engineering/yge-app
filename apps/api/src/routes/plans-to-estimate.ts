// Plans-to-Estimate — AI endpoint. Takes uploaded plan set or spec files,
// runs them through Claude, and returns a draft estimate for the user to
// review and adjust.
//
// NOTE: Skeleton only. Fills in during Phase 1 weeks 4-8.

import { Router } from 'express';
import { PlansToEstimateInputSchema } from '@yge/shared';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';

export const plansToEstimateRouter = Router();

plansToEstimateRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PlansToEstimateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    // TODO (Phase 1 weeks 4-8):
    //  1. Pull file keys from Supabase Storage, OCR if needed.
    //  2. Chunk PDF pages into sections (cover, specs, plan sheets by discipline).
    //  3. Run each section through Claude with the plans-to-estimate prompt.
    //  4. Aggregate quantities per bid item type.
    //  5. Look up matching rate records in the company's master tables.
    //  6. Produce a draft Estimate + BidItems + CostLines with confidence scores.
    //  7. Return the draft ID; UI opens it in "review draft" mode.

    // Echo the request so the endpoint is callable during build-out:
    res.status(501).json({
      message: 'Plans-to-Estimate endpoint scaffolded — implementation pending.',
      input: parsed.data,
      model: DEFAULT_MODEL,
      clientReady: Boolean(anthropic),
    });
  } catch (err) {
    next(err);
  }
});
