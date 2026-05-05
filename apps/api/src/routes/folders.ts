// Folders routes — CRUD for the /files explorer.

import { Router } from 'express';
import { z } from 'zod';
import {
  FolderCreateSchema,
  FolderPatchSchema,
} from '@yge/shared';
import {
  createFolder,
  deleteFolder,
  getFolder,
  listFolders,
  updateFolder,
} from '../lib/folders-store';

export const foldersRouter = Router();

foldersRouter.get('/', async (_req, res, next) => {
  try {
    const folders = await listFolders();
    return res.json({ folders });
  } catch (err) {
    next(err);
  }
});

foldersRouter.get('/:id', async (req, res, next) => {
  try {
    const folder = await getFolder(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    return res.json({ folder });
  } catch (err) {
    next(err);
  }
});

foldersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = FolderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const folder = await createFolder(parsed.data);
    return res.status(201).json({ folder });
  } catch (err) {
    next(err);
  }
});

foldersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = FolderPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    try {
      const updated = await updateFolder(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Folder not found' });
      return res.json({ folder: updated });
    } catch (err) {
      // Cycle guards from the store throw; surface as 400.
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Update rejected' });
    }
  } catch (err) {
    next(err);
  }
});

foldersRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteFolder(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Folder not found' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
