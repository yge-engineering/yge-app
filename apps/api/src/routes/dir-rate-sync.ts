// DIR rate sync routes — sync runs + staged proposals + accept/reject.
//
// Exposes the staging area to the web review screen. Heavy lifting
// (the scraper + the AI extractor that turns a posted PDF into
// structured DirRate fields) lives elsewhere. These routes move
// proposals through the gate.

import { Router } from 'express';
import { z } from 'zod';
import {
  buildAcceptedApplication,
  computeProposalDiff,
  DirRateProposalStatusSchema,
  DirRateSyncSourceSchema,
  type DirRate,
} from '@yge/shared';
import {
  acceptProposal,
  createSyncRun,
  getProposal,
  getSyncRun,
  listProposals,
  listSyncRuns,
  rejectProposal,
} from '../lib/dir-rate-sync-store';
import {
  createDirRate,
  getDirRate,
  listDirRates,
  updateDirRate,
} from '../lib/dir-rates-store';

export const dirRateSyncRouter = Router();

// ---- Sync runs ----------------------------------------------------------

dirRateSyncRouter.get('/runs', async (_req, res, next) => {
  try {
    const runs = await listSyncRuns();
    runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return res.json({ runs });
  } catch (err) { next(err); }
});

dirRateSyncRouter.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await getSyncRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Sync run not found' });
    return res.json({ run });
  } catch (err) { next(err); }
});

const CreateRunSchema = z.object({
  source: DirRateSyncSourceSchema,
  initiatedByUserId: z.string().max(120).optional(),
  sourceReference: z.string().max(800).optional(),
  summary: z.string().max(8000).optional(),
});

dirRateSyncRouter.post('/runs', async (req, res, next) => {
  try {
    const parsed = CreateRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const run = await createSyncRun(parsed.data);
    // The scraper job is a separate worker that picks up QUEUED runs
    // off this list. Phase 1 returns the queued row; the scheduled
    // scrape lands in a later commit.
    return res.status(201).json({ run });
  } catch (err) { next(err); }
});

// ---- Proposals ----------------------------------------------------------

const ProposalListQuerySchema = z.object({
  status: DirRateProposalStatusSchema.optional(),
  syncRunId: z.string().min(1).max(80).optional(),
  classification: z.string().min(1).max(80).optional(),
  county: z.string().min(1).max(80).optional(),
});

async function attachDiff(p: Awaited<ReturnType<typeof getProposal>>) {
  if (!p) return null;
  const existing = p.existingRateId ? await getDirRate(p.existingRateId) : null;
  const diff = computeProposalDiff(existing, p.proposedRate);
  return { ...p, diff };
}

dirRateSyncRouter.get('/proposals', async (req, res, next) => {
  try {
    const parsed = ProposalListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const proposals = await listProposals(parsed.data);
    // Sort by status (PENDING first, then by createdAt desc within).
    proposals.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'PENDING' ? -1 : b.status === 'PENDING' ? 1 : 0;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    // Attach the diff per row so the list renders side-by-side.
    const liveRates = await listDirRates();
    const liveById = new Map<string, DirRate>(liveRates.map((r) => [r.id, r]));
    const enriched = proposals.map((p) => ({
      ...p,
      diff: computeProposalDiff(
        p.existingRateId ? liveById.get(p.existingRateId) ?? null : null,
        p.proposedRate,
      ),
    }));
    return res.json({ proposals: enriched });
  } catch (err) { next(err); }
});

dirRateSyncRouter.get('/proposals/:id', async (req, res, next) => {
  try {
    const enriched = await attachDiff(await getProposal(req.params.id));
    if (!enriched) return res.status(404).json({ error: 'Proposal not found' });
    return res.json({ proposal: enriched });
  } catch (err) { next(err); }
});

const AcceptSchema = z.object({
  reviewedByUserId: z.string().min(1).max(120).optional(),
  reviewNote: z.string().max(2000).optional(),
});

/**
 * Accept a proposal. Two side effects:
 *   1) Proposal status flips PENDING -> ACCEPTED via the store
 *   2) buildAcceptedApplication produces the body to write into
 *      the live DirRate store (createDirRate or updateDirRate)
 */
dirRateSyncRouter.post('/proposals/:id/accept', async (req, res, next) => {
  try {
    const parsed = AcceptSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const proposal = await getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') {
      return res.status(409).json({
        error: `Proposal is ${proposal.status}; only PENDING proposals can be accepted`,
      });
    }
    const existing = proposal.existingRateId
      ? await getDirRate(proposal.existingRateId)
      : null;
    const application = buildAcceptedApplication(proposal, existing);
    const ctx = {
      actorUserId: parsed.data.reviewedByUserId ?? null,
      reason: parsed.data.reviewNote ?? null,
    };

    // Apply the change to the live rate store first; if that fails,
    // leave the proposal PENDING so the operator sees the error and
    // can retry without losing the staged data.
    let appliedRate: DirRate;
    if (application.mode === 'create') {
      appliedRate = await createDirRate(application.body, ctx);
    } else if (application.targetRateId) {
      const updated = await updateDirRate(application.targetRateId, application.body, ctx, 'update');
      if (!updated) {
        return res.status(409).json({
          error: `Existing rate ${application.targetRateId} disappeared between proposal creation and accept`,
        });
      }
      appliedRate = updated;
    } else {
      return res.status(500).json({ error: 'Unreachable: update mode without targetRateId' });
    }

    const accepted = await acceptProposal(
      proposal.id,
      parsed.data.reviewedByUserId ?? null,
      parsed.data.reviewNote,
      ctx,
    );
    return res.json({ proposal: accepted, appliedRate });
  } catch (err) { next(err); }
});

const RejectSchema = z.object({
  reviewedByUserId: z.string().min(1).max(120).optional(),
  reviewNote: z.string().min(1).max(2000),
});

dirRateSyncRouter.post('/proposals/:id/reject', async (req, res, next) => {
  try {
    const parsed = RejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await rejectProposal(
      req.params.id,
      parsed.data.reviewedByUserId ?? null,
      parsed.data.reviewNote,
    );
    if (!updated) return res.status(404).json({ error: 'Proposal not found' });
    return res.json({ proposal: updated });
  } catch (err) { next(err); }
});
