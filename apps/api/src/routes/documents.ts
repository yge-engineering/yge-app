// Documents routes — metadata + binary file vault.
//
// Plain English: legacy CRUD (GET / GET-id / POST / PATCH) keeps the
// existing metadata-only model. New endpoints layer file storage on
// top:
//   POST /api/documents/upload      multipart upload (one file +
//                                   optional folderId/title/jobId/
//                                   kind metadata)
//   GET  /api/documents/:id/download streams the blob with the
//                                   original mime type + filename

import { Router } from 'express';
import multer from 'multer';
import {
  DocumentCreateSchema,
  DocumentKindSchema,
  DocumentPatchSchema,
} from '@yge/shared';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from '../lib/documents-store';
import {
  blobStream,
  readBlobMeta,
  writeBlob,
  blobExists,
} from '../lib/document-blobs';

export const documentsRouter = Router();

// 50 MB cap per file. Render's persistent disk is 1 GB; this keeps a
// single file from exhausting it. Tweak when we move to Supabase
// Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

documentsRouter.get('/', async (req, res, next) => {
  try {
    const documents = await listDocuments({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
      tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
    });
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
});

documentsRouter.get('/:id', async (req, res, next) => {
  try {
    const d = await getDocument(req.params.id);
    if (!d) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: d });
  } catch (err) {
    next(err);
  }
});

documentsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = DocumentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const d = await createDocument(parsed.data);
    return res.status(201).json({ document: d });
  } catch (err) {
    next(err);
  }
});

documentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = DocumentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateDocument(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: updated });
  } catch (err) {
    next(err);
  }
});

// ---- File upload ---------------------------------------------------------

documentsRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const titleRaw = req.body?.title;
    const folderIdRaw = req.body?.folderId;
    const jobIdRaw = req.body?.jobId;
    const kindRaw = req.body?.kind;

    const title =
      typeof titleRaw === 'string' && titleRaw.trim().length > 0
        ? titleRaw.trim()
        : req.file.originalname;
    const kindParse = DocumentKindSchema.safeParse(kindRaw);
    const kind = kindParse.success ? kindParse.data : 'OTHER';

    // Create the row first so we have an id.
    const doc = await createDocument({
      title,
      kind,
      tags: [],
      ...(typeof folderIdRaw === 'string' && folderIdRaw.length > 0
        ? { folderId: folderIdRaw }
        : {}),
      ...(typeof jobIdRaw === 'string' && jobIdRaw.length > 0
        ? { jobId: jobIdRaw }
        : {}),
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      hasBlob: true,
    });

    await writeBlob(doc.id, req.file.buffer, {
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
      originalFileName: req.file.originalname,
    });

    return res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

// ---- Download ------------------------------------------------------------

documentsRouter.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.hasBlob || !(await blobExists(doc.id))) {
      return res
        .status(404)
        .json({ error: 'Document has no uploaded file' });
    }
    const meta = await readBlobMeta(doc.id);
    const mimeType = meta?.mimeType ?? doc.mimeType ?? 'application/octet-stream';
    const fileName =
      meta?.originalFileName ?? doc.originalFileName ?? `${doc.id}.bin`;
    res.setHeader('Content-Type', mimeType);
    if (meta?.size !== undefined) {
      res.setHeader('Content-Length', String(meta.size));
    }
    // inline so PDFs render in the browser tab; downloads still work
    // via the browser's "Save as" menu.
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileName)}"`,
    );
    const stream = blobStream(doc.id);
    if (!stream) return res.status(500).json({ error: 'Could not open file' });
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});
