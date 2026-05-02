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
  DirRateSchema,
  DirRateSyncSourceSchema,
  type DirRate,
} from '@yge/shared';
import {
  acceptProposal,
  createProposal,
  createSyncRun,
  getProposal,
  getSyncRun,
  listProposals,
  listSyncRuns,
  rejectProposal,
  updateSyncRunStatus,
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

// ---- Manual import -----------------------------------------------------

const ProposedRateBodySchema = DirRateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const ManualImportSchema = z.object({
  /** Optional plain-English summary stored on the run row. */
  summary: z.string().max(8000).optional(),
  /** Optional source URL or PDF reference. */
  sourceReference: z.string().max(800).optional(),
  /** Operator running the import — recorded on the run row. */
  initiatedByUserId: z.string().max(120).optional(),
  /** The proposed rate updates. The route writes one DirRateProposal
   *  per entry, linked back to the new sync run. */
  proposals: z
    .array(
      z.object({
        rationale: z.string().max(8000).optional(),
        proposedRate: ProposedRateBodySchema,
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Operator-driven 'manual' DIR rate import. Creates a sync run with
 * source=PDF_IMPORT (the closest existing source kind for an
 * operator-typed batch), then drops one proposal per entry. The
 * route resolves each proposal's existingRateId by looking up the
 * live DirRate set for the (classification, county) — null for
 * brand-new determinations.
 *
 * Real automated scraping (Caltrans-quality fetch + parse) layers
 * on top of this with the same proposal-creation tail; until then,
 * this is the way YGE updates proposals from a DIR website check
 * Ryan or Brook do by hand.
 */
dirRateSyncRouter.post('/manual-import', async (req, res, next) => {
  try {
    const parsed = ManualImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const startedAt = new Date().toISOString();
    let run = await createSyncRun({
      source: 'PDF_IMPORT',
      summary: parsed.data.summary,
      sourceReference: parsed.data.sourceReference,
      initiatedByUserId: parsed.data.initiatedByUserId,
      status: 'RUNNING',
      startedAt,
    });

    const liveRates = await listDirRates();
    const liveByKey = new Map<string, DirRate>();
    for (const r of liveRates) {
      // Most-recent rate per (classification, county) wins. The
      // proposal can target the older row explicitly via the diff
      // engine if needed; this lookup is the default.
      const key = `${r.classification}::${r.county}`;
      const existing = liveByKey.get(key);
      if (!existing || r.effectiveDate > existing.effectiveDate) {
        liveByKey.set(key, r);
      }
    }

    let created = 0;
    let failed = 0;
    const errorMessages: string[] = [];
    const proposalIds: string[] = [];
    for (const entry of parsed.data.proposals) {
      try {
        const key = `${entry.proposedRate.classification}::${entry.proposedRate.county}`;
        const existing = liveByKey.get(key) ?? null;
        const created_ = await createProposal({
          syncRunId: run.id,
          classification: entry.proposedRate.classification,
          county: entry.proposedRate.county,
          existingRateId: existing?.id ?? null,
          proposedRate: entry.proposedRate,
          rationale: entry.rationale,
        });
        proposalIds.push(created_.id);
        created += 1;
      } catch (err) {
        failed += 1;
        errorMessages.push(err instanceof Error ? err.message : String(err));
      }
    }

    const finishedAt = new Date().toISOString();
    const status = failed === 0 ? 'SUCCESS' : created === 0 ? 'FAILED' : 'PARTIAL';
    const updated = await updateSyncRunStatus(run.id, {
      status,
      finishedAt,
      proposalsCreated: created,
      classificationsScraped: created,
      classificationsFailed: failed,
      errorMessages,
    });
    if (updated) run = updated;

    return res.status(201).json({
      run,
      created,
      failed,
      proposalIds,
    });
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
