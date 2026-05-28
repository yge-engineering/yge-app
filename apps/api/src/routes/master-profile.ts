// 1711 — master profile surface check — endpoints exist + healthy.
// Master business profile route. Single-row endpoint.
//
// GET  /api/master-profile             read the row (seeds on first read)
// GET  /api/master-profile/export.json download the full row as JSON
// PATCH /api/master-profile             partial update; returns the new row

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

// Downloadable backup of the full profile. Plain JSON — the same
// shape PATCH accepts (minus id/createdAt) so a future restore
// flow can round-trip through the same endpoint.
//
// Filename includes the current date so multiple backups don't
// collide on disk. Browsers honor Content-Disposition: attachment
// for actual downloads.
masterProfileRouter.get('/export.json', async (_req, res, next) => {
  try {
    const profile = await getMasterProfile();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `master-profile-${date}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return res.send(JSON.stringify(profile, null, 2));
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
