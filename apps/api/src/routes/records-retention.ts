// Records-retention routes — dry-run report + per-bucket confirm.

import { Router } from 'express';
import { RetentionPurgeBatchCreateSchema } from '@yge/shared';
import { buildRetentionPurgeReport } from '../lib/records-retention-job';
import {
  confirmRetentionPurge,
  listRetentionPurgeBatches,
} from '../lib/records-retention-purges-store';

export const recordsRetentionRouter = Router();

recordsRetentionRouter.get('/purge-report', async (_req, res, next) => {
  try {
    const report = await buildRetentionPurgeReport();
    return res.json({ report });
  } catch (err) { next(err); }
});

recordsRetentionRouter.get('/purge-batches', async (_req, res, next) => {
  try {
    const batches = await listRetentionPurgeBatches();
    return res.json({ batches });
  } catch (err) { next(err); }
});

recordsRetentionRouter.post('/confirm-purge', async (req, res, next) => {
  try {
    const parsed = RetentionPurgeBatchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const result = await confirmRetentionPurge(parsed.data);
    if (!result.batch) {
      return res.status(409).json({
        error: 'No rows accepted',
        rejectedNotEligible: result.rejectedNotEligible,
        rejectedFrozen: result.rejectedFrozen,
        rejectedUnknown: result.rejectedUnknown,
      });
    }
    return res.status(201).json({
      batch: result.batch,
      rejectedNotEligible: result.rejectedNotEligible,
      rejectedFrozen: result.rejectedFrozen,
      rejectedUnknown: result.rejectedUnknown,
    });
  } catch (err) { next(err); }
});
