// Records-retention purge dry-run endpoint.

import { Router } from 'express';
import { buildRetentionPurgeReport } from '../lib/records-retention-job';

export const recordsRetentionRouter = Router();

recordsRetentionRouter.get('/purge-report', async (_req, res, next) => {
  try {
    const report = await buildRetentionPurgeReport();
    return res.json({ report });
  } catch (err) { next(err); }
});
