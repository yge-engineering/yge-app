// Photo upload endpoint — body bytes go to Supabase Storage; the
// caller then POSTs the metadata to /api/photos with the returned
// objectKey as Photo.reference.

import { Router } from 'express';
import multer from 'multer';
import {
  isStorageConfigured,
  newObjectKey,
  signedUrl,
  uploadObject,
} from '../lib/storage';
import { logger } from '../lib/logger';

export const photosUploadRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  // 25 MB cap. iPhone "live" + raw photos run 6-15 MB; a comfortable
  // ceiling without inviting plan-set-sized blobs onto this endpoint.
  limits: { fileSize: 25 * 1024 * 1024 },
});

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);

function extFor(file: { mimetype: string; originalname: string }): string {
  const dotIdx = file.originalname.lastIndexOf('.');
  if (dotIdx >= 0 && dotIdx < file.originalname.length - 1) {
    return file.originalname.slice(dotIdx + 1).toLowerCase();
  }
  switch (file.mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

photosUploadRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        error:
          'Supabase Storage is not configured (NEXT_PUBLIC_SUPABASE_URL + ' +
          'SUPABASE_SERVICE_ROLE_KEY required).',
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!ALLOWED_TYPES.has(req.file.mimetype)) {
      return res
        .status(400)
        .json({ error: `Unsupported image type: ${req.file.mimetype}` });
    }

    const start = Date.now();
    const key = newObjectKey('photos', extFor(req.file));
    const result = await uploadObject(
      'yge-photos',
      key,
      req.file.buffer,
      req.file.mimetype,
    );
    const url = await signedUrl('yge-photos', key, 600);

    logger.info(
      {
        bucket: result.bucket,
        objectKey: result.objectKey,
        sizeBytes: result.size,
        contentType: result.contentType,
        elapsedMs: Date.now() - start,
      },
      'Photo upload OK',
    );

    return res.json({
      bucket: result.bucket,
      objectKey: result.objectKey,
      size: result.size,
      contentType: result.contentType,
      signedUrl: url,
      // The /api/photos POST body wants this in `reference`.
      reference: result.objectKey,
    });
  } catch (err) {
    next(err);
  }
});
