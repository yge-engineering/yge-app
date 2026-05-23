// /api/backups — manifest snapshots of the persistent data root.
//
// POST  /api/backups            — create a new snapshot, returns the manifest.
// GET   /api/backups            — list snapshots (most-recent first).
// GET   /api/backups/:id        — fetch one manifest.

import { Router } from 'express';
import { z } from 'zod';

import { createBackupSnapshot, getBackup, listBackups } from '../lib/backups-store';

export const backupsRouter = Router();

const CreateBackupSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).optional(),
  /** When the caller is an actual user (not the scheduler), pass their
   *  display name / email so the manifest carries it. Defaults to 'manual'. */
  triggeredBy: z.string().min(1).max(120).optional(),
});

backupsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CreateBackupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const manifest = await createBackupSnapshot({
      label: parsed.data.label,
      note: parsed.data.note,
      triggeredBy: parsed.data.triggeredBy ?? 'manual',
    });
    return res.status(201).json({ backup: manifest });
  } catch (err) {
    next(err);
  }
});

backupsRouter.get('/', async (_req, res, next) => {
  try {
    const backups = await listBackups();
    return res.json({ backups });
  } catch (err) {
    next(err);
  }
});

backupsRouter.get('/:id', async (req, res, next) => {
  try {
    const backup = await getBackup(req.params.id ?? '');
    if (!backup) return res.status(404).json({ error: 'Not found' });
    return res.json({ backup });
  } catch (err) {
    next(err);
  }
});
