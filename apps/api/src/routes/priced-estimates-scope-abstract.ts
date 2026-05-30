// POST /api/priced-estimates/:id/scope-abstract — AI scope abstract
// for the bid transmittal cover letter.
//
// Same pattern as priced-estimates-review.ts: fetch the estimate,
// call the AI wrapper, return JSON. No persistence — each request
// is an independent Anthropic call.

import { Router } from 'express';
import { getEstimate } from '../lib/estimates-store';
import { generateBidScopeAbstract } from '../lib/bid-scope-abstract';

export const pricedEstimatesScopeAbstractRouter = Router({ mergeParams: true });

pricedEstimatesScopeAbstractRouter.post('/:id/scope-abstract', async (req, res, next) => {
  try {
    const est = await getEstimate(req.params.id);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const out = await generateBidScopeAbstract(est);
    if (!out) {
      return res.status(502).json({
        error: 'AI returned an unparseable response. Please retry.',
      });
    }
    return res.json(out);
  } catch (err) {
    next(err);
  }
});
