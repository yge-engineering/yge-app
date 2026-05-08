import { Router } from 'express';
import { getEstimate } from '../lib/estimates-store';
import { reviewBid } from '../lib/bid-reviewer';

export const pricedEstimatesReviewRouter = Router({ mergeParams: true });

pricedEstimatesReviewRouter.post('/:id/review', async (req, res, next) => {
  try {
    const est = await getEstimate(req.params.id);
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const out = await reviewBid(est);
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
