// Master business profile route. Single-row endpoint.
//
// GET  /api/master-profile        read the row (seeds on first read)
// PATCH /api/master-profile        partial update; returns the new row

import { Router } from 'express';
import { MasterProfileSchema } from '@yge/shared';
import { getMasterProfile, updateMasterProfile } from '../lib/master-profile-store';

export const masterProfileRouter = Router();

masterProfileRouter.get('/', async (_req, res, next) => {
  try {
    const profile = await getMasterProfile();
    return res.json({ profile });
  } catch (err) { next(err); }
});

const PatchSchema = MasterProfileSchema.partial();

masterProfileRouter.patch('/', async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const profile = await updateMasterProfile(parsed.data);
    return res.json({ profile });
  } catch (err) { next(err); }
});
