// Certified payroll routes.

import { Router } from 'express';
import {
  CertifiedPayrollCreateSchema,
  CertifiedPayrollPatchSchema,
  cprSubmitBlockers,
} from '@yge/shared';
import {
  createCertifiedPayroll,
  getCertifiedPayroll,
  listCertifiedPayrolls,
  updateCertifiedPayroll,
} from '../lib/certified-payrolls-store';

export const certifiedPayrollsRouter = Router();

certifiedPayrollsRouter.get('/', async (req, res, next) => {
  try {
    const cprs = await listCertifiedPayrolls({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ certifiedPayrolls: cprs });
  } catch (err) {
    next(err);
  }
});

certifiedPayrollsRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getCertifiedPayroll(req.params.id);
    if (!c) return res.status(404).json({ error: 'Certified payroll not found' });
    return res.json({ certifiedPayroll: c });
  } catch (err) {
    next(err);
  }
});

certifiedPayrollsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = CertifiedPayrollCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createCertifiedPayroll(parsed.data);
    return res.status(201).json({ certifiedPayroll: c });
  } catch (err) {
    next(err);
  }
});

certifiedPayrollsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = CertifiedPayrollPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateCertifiedPayroll(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Certified payroll not found' });
    return res.json({ certifiedPayroll: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/certified-payrolls/:id/submit — runs blockers check.
certifiedPayrollsRouter.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await getCertifiedPayroll(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Certified payroll not found' });
    const blockers = cprSubmitBlockers(existing);
    if (blockers.length > 0) {
      return res.status(409).json({ error: 'Submission blocked', blockers });
    }
    const updated = await updateCertifiedPayroll(req.params.id, {
      status: 'SUBMITTED',
    });
    if (!updated) return res.status(404).json({ error: 'Certified payroll not found' });
    return res.json({ certifiedPayroll: updated });
  } catch (err) {
    next(err);
  }
});
