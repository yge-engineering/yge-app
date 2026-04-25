// Plans-to-Estimate — AI endpoint. Takes a project document (plan set, spec,
// or RFP) as text and returns a draft estimate the user reviews and adjusts.
//
// Phase 1 weeks 4-8 will add: pulling files from Supabase Storage, OCR for
// scanned PDFs, page-chunking large plan sets, persisting the draft to the
// Estimate / BidItem tables. For now the endpoint accepts already-extracted
// document text so the AI flow is end-to-end testable.

import { Router } from 'express';
import { z } from 'zod';
import { runPlansToEstimate, PlansToEstimateError } from '../services/plans-to-estimate';

export const plansToEstimateRouter = Router();

const InlineInputSchema = z.object({
  jobId: z.string().cuid(),
  documentText: z.string().min(20).max(500_000),
  sessionNotes: z.string().max(5_000).optional(),
});

plansToEstimateRouter.post('/', async (req, res, next) => {
  try {
    const parsed = InlineInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const result = await runPlansToEstimate({
      documentText: parsed.data.documentText,
      sessionNotes: parsed.data.sessionNotes,
    });

    return res.json({
      jobId: parsed.data.jobId,
      modelUsed: result.modelUsed,
      promptVersion: result.promptVersion,
      usage: result.usage,
      draft: result.output,
    });
  } catch (err) {
    if (err instanceof PlansToEstimateError) {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});
