// Photo log routes.

import { Router } from 'express';
import { PhotoCreateSchema, PhotoPatchSchema } from '@yge/shared';
import {
  createPhoto,
  getPhoto,
  listPhotos,
  updatePhoto,
} from '../lib/photos-store';

export const photosRouter = Router();

photosRouter.get('/', async (req, res, next) => {
  try {
    const photos = await listPhotos({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
    });
    return res.json({ photos });
  } catch (err) {
    next(err);
  }
});

photosRouter.get('/:id', async (req, res, next) => {
  try {
    const p = await getPhoto(req.params.id);
    if (!p) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ photo: p });
  } catch (err) {
    next(err);
  }
});

photosRouter.post('/', async (req, res, next) => {
  try {
    const parsed = PhotoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const p = await createPhoto(parsed.data);
    return res.status(201).json({ photo: p });
  } catch (err) {
    next(err);
  }
});

photosRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = PhotoPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updatePhoto(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ photo: updated });
  } catch (err) {
    next(err);
  }
});
