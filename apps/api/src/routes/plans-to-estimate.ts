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
import { saveDraft, listDrafts, getDraft } from '../lib/drafts-store';

export const plansToEstimateRouter = Router();

const InlineInputSchema = z.object({
  jobId: z.string().cuid(),
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
