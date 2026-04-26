// Certificates routes.

import { Router } from 'express';
import {
  CertificateCreateSchema,
  CertificatePatchSchema,
} from '@yge/shared';
import {
  createCertificate,
  getCertificate,
  listCertificates,
  updateCertificate,
} from '../lib/certificates-store';

export const certificatesRouter = Router();

certificatesRouter.get('/', async (_req, res, next) => {
  try {
    const certificates = await listCertificates();
    return res.json({ certificates });
  } catch (err) {
    next(err);
  }
});

certificatesRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getCertificate(req.params.id);
    if (!c) return res.status(404).json({ error: 'Certificate not found' });
    return res.json({ certificate: c });
  } catch (err) {
    next(err);
  }
});

certificatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CertificateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createCertificate(parsed.data);
    return res.status(201).json({ certificate: c });
  } catch (err) {
    next(err);
  }
});

certificatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CertificatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCertificate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Certificate not found' });
    return res.json({ certificate: updated });
  } catch (err) {
    next(err);
  }
});
