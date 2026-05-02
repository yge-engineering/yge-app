// Plans-to-Estimate — AI endpoint. Takes a project document (plan set, spec,
// or RFP) as text and returns a draft estimate the user reviews and adjusts.
//
// Phase 1 weeks 4-8 will add: pulling files from Supabase Storage, OCR for
// scanned PDFs, page-chunking large plan sets, persisting the draft to the
// Estimate / BidItem tables. For now the endpoint accepts already-extracted
// document text so the AI flow is end-to-end testable.

import { Router } from 'express';
import { z } from 'zod';
import { bidItemsToCsv } from '@yge/shared';
import { runPlansToEstimate, PlansToEstimateError } from '../services/plans-to-estimate';
import { runScopeGap, ScopeGapError } from '../services/plans-to-estimate-scope-gap';
import {
  runMultiPass,
  MultiPassError,
} from '../services/plans-to-estimate-multipass';
import { saveDraft, listDrafts, getDraft } from '../lib/drafts-store';

export const plansToEstimateRouter = Router();

// jobId format matches the file-backed jobs store id format
// (`job-YYYY-MM-DD-slug-<8hex>`). When Postgres lands and ids become CUIDs we
// loosen this back to z.string().cuid().
const InlineInputSchema = z.object({
  jobId: z.string().regex(/^job-[a-z0-9-]{10,80}$/),
  documentText: z.string().min(20).max(500_000),
  sessionNotes: z.string().max(5_000).optional(),
});

// POST /api/plans-to-estimate — generate a draft and save it to history.
plansToEstimateRouter.post('/', async (req, res, next) => {
  try {
    const parsed = InlineInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const start = Date.now();
    const result = await runPlansToEstimate({
      documentText: parsed.data.documentText,
      sessionNotes: parsed.data.sessionNotes,
    });
    const durationMs = Date.now() - start;

    // Persist for the history page. If save fails for any reason, we still
    // return the draft to the caller — losing the file is annoying but
    // re-running the AI to recover would be much worse.
    let savedId: string | undefined;
    try {
      const saved = await saveDraft({
        jobId: parsed.data.jobId,
        modelUsed: result.modelUsed,
        promptVersion: result.promptVersion,
        usage: result.usage,
        durationMs,
        documentText: parsed.data.documentText,
        sessionNotes: parsed.data.sessionNotes,
        draft: result.output,
      });
      savedId = saved.id;
    } catch (err) {
      // Log via the request logger if pino-http attached it; never throw —
      // losing the file is annoying but losing the AI draft is much worse.
      const log = (req as { log?: { error?: (...a: unknown[]) => void } }).log;
      log?.error?.({ err }, 'Failed to persist draft');
    }

    return res.json({
      jobId: parsed.data.jobId,
      savedId,
      modelUsed: result.modelUsed,
      promptVersion: result.promptVersion,
      usage: result.usage,
      durationMs,
      draft: result.output,
    });
  } catch (err) {
    if (err instanceof PlansToEstimateError) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/plans-to-estimate/drafts — newest-first summary list.
plansToEstimateRouter.get('/drafts', async (_req, res, next) => {
  try {
    const drafts = await listDrafts();
    return res.json({ drafts });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans-to-estimate/drafts/:id — full saved draft.
plansToEstimateRouter.get('/drafts/:id', async (req, res, next) => {
  try {
    const draft = await getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    return res.json({ draft });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans-to-estimate/drafts/:id/export.csv — bid items as a CSV
// download. Same bytes as the in-page Download CSV button (both use
// POST /api/plans-to-estimate/multipass — multi-pass orchestrator.
// Runs three specialized prompts (title-block, bid-schedule,
// spec-extras) and stitches the results into a single PtoEOutput.
// The single-pass POST / endpoint stays as the lightweight default
// for small RFPs; this endpoint is opt-in for larger plan sets
// where each pass benefits from a tighter prompt.
const MultiPassInputSchema = z.object({
  jobId: z.string().regex(/^job-[a-z0-9-]{10,80}$/),
  /** Title block / front-matter text. */
  titleBlockText: z.string().min(20).max(200_000),
  /** Bid schedule text. */
  bidScheduleText: z.string().min(20).max(200_000),
  /** Spec text (optional). When omitted, the spec-extras pass is skipped. */
  specText: z.string().min(20).max(800_000).optional(),
  sessionNotes: z.string().max(5_000).optional(),
});

plansToEstimateRouter.post('/multipass', async (req, res, next) => {
  try {
    const parsed = MultiPassInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const start = Date.now();
    const result = await runMultiPass({
      titleBlockText: parsed.data.titleBlockText,
      bidScheduleText: parsed.data.bidScheduleText,
      specText: parsed.data.specText,
      sessionNotes: parsed.data.sessionNotes,
    });
    const durationMs = Date.now() - start;

    // Save under the same drafts store so the history page lists
    // multi-pass runs alongside single-pass runs.
    const totalUsage = {
      inputTokens:
        result.passes.titleBlock.inputTokens +
        result.passes.bidSchedule.inputTokens +
        (result.passes.specExtras?.inputTokens ?? 0),
      outputTokens:
        result.passes.titleBlock.outputTokens +
        result.passes.bidSchedule.outputTokens +
        (result.passes.specExtras?.outputTokens ?? 0),
    };
    let savedId: string | undefined;
    try {
      const documentText = [
        '--- TITLE BLOCK ---',
        parsed.data.titleBlockText,
        '--- BID SCHEDULE ---',
        parsed.data.bidScheduleText,
        ...(parsed.data.specText ? ['--- SPECIFICATIONS ---', parsed.data.specText] : []),
      ].join('\n\n');
      const saved = await saveDraft({
        jobId: parsed.data.jobId,
        modelUsed: result.modelUsed,
        promptVersion: `multipass(${result.passes.titleBlock.promptVersion} + ${result.passes.bidSchedule.promptVersion}${
          result.passes.specExtras ? ` + ${result.passes.specExtras.promptVersion}` : ''
        })`,
        usage: totalUsage,
        durationMs,
        documentText,
        sessionNotes: parsed.data.sessionNotes,
        draft: result.output,
      });
      savedId = saved.id;
    } catch (_err) {
      // Same fail-soft pattern as single-pass: don't lose the draft
      // because the on-disk save broke.
    }

    return res.json({
      output: result.output,
      modelUsed: result.modelUsed,
      passes: result.passes,
      durationMs,
      ...(savedId ? { savedId } : {}),
    });
  } catch (err) {
    if (err instanceof MultiPassError) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/plans-to-estimate/scope-gap — AI pre-bid review.
// Reads the spec text + a draft estimate JSON, returns a ScopeGapReport.
const ScopeGapInputSchema = z.object({
  /** Stringified draft estimate JSON. The endpoint accepts the full
   *  PtoEOutput body, the saved-draft body, or any other JSON the
   *  estimator wants the model to compare against the spec text. */
  draftJson: z.string().min(2).max(500_000),
  /** Spec text (RFP, technical specifications). The endpoint expects
   *  text already extracted from the agency document; OCR / page-
   *  chunking lives upstream. */
  specText: z.string().min(20).max(800_000),
});

plansToEstimateRouter.post('/scope-gap', async (req, res, next) => {
  try {
    const parsed = ScopeGapInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const start = Date.now();
    const result = await runScopeGap({
      draftJson: parsed.data.draftJson,
      specText: parsed.data.specText,
    });
    const durationMs = Date.now() - start;
    return res.json({
      report: result.report,
      modelUsed: result.modelUsed,
      promptVersion: result.promptVersion,
      usage: result.usage,
      durationMs,
    });
  } catch (err) {
    if (err instanceof ScopeGapError) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

// `bidItemsToCsv` from @yge/shared) — useful for direct links, scripted
// pulls, or attaching to an email.
plansToEstimateRouter.get('/drafts/:id/export.csv', async (req, res, next) => {
  try {
    const draft = await getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    const csv = bidItemsToCsv(draft.draft.bidItems);
    const slug = draft.draft.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'draft-estimate';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}-bid-items.csv"`,
    );
    // BOM so Excel reads it as UTF-8 even on Windows.
    return res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});
