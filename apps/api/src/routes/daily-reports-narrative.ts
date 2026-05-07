// AI narrative-expansion endpoint for the daily report.

import { Router } from 'express';
import { z } from 'zod';
import { expandDailyReportNarrative } from '../lib/daily-report-narrative';

export const dailyReportsNarrativeRouter = Router({ mergeParams: true });

const ExpandRequestSchema = z.object({
  bullets: z.array(z.string().min(1).max(2_000)).min(1).max(20),
  jobName: z.string().max(200).optional(),
  date: z.string().max(40).optional(),
});

dailyReportsNarrativeRouter.post('/narrative', async (req, res, next) => {
  try {
    const parsed = ExpandRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const out = await expandDailyReportNarrative(parsed.data);
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
