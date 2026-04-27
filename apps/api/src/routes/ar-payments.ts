// AR payment routes.

import { Router } from 'express';
import { ArPaymentCreateSchema, ArPaymentPatchSchema } from '@yge/shared';
import {
  createArPayment,
  getArPayment,
  listArPayments,
  updateArPayment,
} from '../lib/ar-payments-store';

export const arPaymentsRouter = Router();

arPaymentsRouter.get('/', async (req, res, next) => {
  try {
    const payments = await listArPayments({
      arInvoiceId:
        typeof req.query.arInvoiceId === 'string' ? req.query.arInvoiceId : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ payments });
  } catch (err) {
    next(err);
  }
});

arPaymentsRouter.get('/:id', async (req, res, next) => {
  try {
    const p = await getArPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'AR payment not found' });
    return res.json({ payment: p });
  } catch (err) {
    next(err);
  }
});

arPaymentsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ArPaymentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const p = await createArPayment(parsed.data);
    return res.status(201).json({ payment: p });
  } catch (err) {
    next(err);
  }
});

arPaymentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ArPaymentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateArPayment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'AR payment not found' });
    return res.json({ payment: updated });
  } catch (err) {
    next(err);
  }
});
