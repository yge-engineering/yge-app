// Bid results routes — agency-posted bid tabulations.
//
// Posting a result with outcome=WON_BY_YGE auto-advances the linked
// job to AWARDED; outcome=WON_BY_OTHER advances to LOST. The side
// effect lives here (not in the pure data module) so it can read both
// stores in one transaction.

import { Router } from 'express';
import {
  BidResultCreateSchema,
  BidResultPatchSchema,
} from '@yge/shared';
import {
  createBidResult,
  getBidResult,
  listBidResults,
  updateBidResult,
} from '../lib/bid-results-store';
import { getJob, updateJob } from '../lib/jobs-store';

export const bidResultsRouter = Router();

/** Side-effect: when a bid result lands with a YGE-decisive outcome,
 *  bump the job's pursuit status. We never demote AWARDED back to
 *  PURSUING — once a contract is signed, that's terminal in the
 *  pipeline. */
async function maybeAdvanceJobStatus(
  jobId: string,
  outcome: 'WON_BY_YGE' | 'WON_BY_OTHER' | 'NO_AWARD' | 'TBD',
): Promise<void> {
  if (outcome === 'TBD' || outcome === 'NO_AWARD') return;
  const job = await getJob(jobId);
  if (!job) return;
  if (outcome === 'WON_BY_YGE' && job.status !== 'AWARDED') {
    await updateJob(jobId, { status: 'AWARDED' });
  } else if (outcome === 'WON_BY_OTHER' && job.status !== 'LOST' && job.status !== 'AWARDED') {
    await updateJob(jobId, { status: 'LOST' });
  }
}

bidResultsRouter.get('/', async (req, res, next) => {
  try {
    const results = await listBidResults({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ results });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getBidResult(req.params.id);
    if (!r) return res.status(404).json({ error: 'Bid result not found' });
    return res.json({ result: r });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = BidResultCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createBidResult(parsed.data);
    await maybeAdvanceJobStatus(r.jobId, r.outcome);
    return res.status(201).json({ result: r });
  } catch (err) {
    next(err);
  }
});

bidResultsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = BidResultPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateBidResult(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Bid result not found' });
    await maybeAdvanceJobStatus(updated.jobId, updated.outcome);
    return res.json({ result: updated });
  } catch (err) {
    next(err);
  }
});
