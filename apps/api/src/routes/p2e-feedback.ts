// Plans-to-Estimate feedback routes.
//
//   POST /api/p2e-feedback  → append { kind, draftId?, estimateId?, notes?, byEmail?, promptVersion? }
//   GET  /api/p2e-feedback  → list every entry (admin / analytics)

import { Router } from 'express';
import { z } from 'zod';
import { appendFeedback, listFeedback } from '../lib/p2e-feedback-store';

export const p2eFeedbackRouter = Router();

const AppendBody = z.object({
  kind: z.enum(['good', 'bad', 'mixed']),
  draftId: z.string().max(120).optional(),
  estimateId: z.string().max(120).optional(),
  notes: z.string().max(2_000).optional(),
  byEmail: z.string().email().max(120).optional(),
  promptVersion: z.string().max(120).optional(),
});

p2eFeedbackRouter.post('/', async (req, res, next) => {
  try {
    const parsed = AppendBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const entry = await appendFeedback(parsed.data);
    return res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

p2eFeedbackRouter.get('/', async (_req, res, next) => {
  try {
    const entries = await listFeedback();
    return res.json({ entries });
  } catch (err) {
    next(err);
  }
});
