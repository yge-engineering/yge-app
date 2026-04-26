// Documents routes — metadata-only PDF / file pointer store.

import { Router } from 'express';
import {
  DocumentCreateSchema,
  DocumentPatchSchema,
} from '@yge/shared';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from '../lib/documents-store';

export const documentsRouter = Router();

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
