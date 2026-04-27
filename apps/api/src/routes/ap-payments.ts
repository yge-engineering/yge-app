// AP payment (check register) routes.

import { Router } from 'express';
import {
  ApPaymentCreateSchema,
  ApPaymentPatchSchema,
  apPaymentMethodLabel,
  csvDollars,
  type ApPayment,
} from '@yge/shared';
import {
  createApPayment,
  getApPayment,
  listApPayments,
  updateApPayment,
} from '../lib/ap-payments-store';
import { maybeCsv } from '../lib/csv-response';

export const apPaymentsRouter = Router();

const AP_PAYMENT_CSV_COLUMNS = [
  { header: 'Paid', get: (p: ApPayment) => p.paidOn },
  { header: 'Vendor', get: (p: ApPayment) => p.vendorName },
  { header: 'Invoice', get: (p: ApPayment) => p.apInvoiceId },
  { header: 'Method', get: (p: ApPayment) => apPaymentMethodLabel(p.method) },
  { header: 'Reference', get: (p: ApPayment) => p.referenceNumber ?? '' },
  { header: 'Bank account', get: (p: ApPayment) => p.bankAccount ?? '' },
  { header: 'Amount', get: (p: ApPayment) => csvDollars(p.amountCents) },
  { header: 'Cleared', get: (p: ApPayment) => (p.cleared ? 'Yes' : 'No') },
  { header: 'Cleared on', get: (p: ApPayment) => p.clearedOn ?? '' },
  { header: 'Voided', get: (p: ApPayment) => (p.voided ? 'Yes' : 'No') },
] as const;

apPaymentsRouter.get('/', async (req, res, next) => {
  try {
    const payments = await listApPayments({
      apInvoiceId:
        typeof req.query.apInvoiceId === 'string' ? req.query.apInvoiceId : undefined,
      method: typeof req.query.method === 'string' ? req.query.method : undefined,
    });
    if (maybeCsv(req, res, payments, AP_PAYMENT_CSV_COLUMNS, 'ap-payments')) return;
    return res.json({ payments });
  } catch (err) {
    next(err);
  }
});

apPaymentsRouter.get('/:id', async (req, res, next) => {
  try {
    const p = await getApPayment(req.params.id);
    if (!p) return res.status(404).json({ error: 'AP payment not found' });
    return res.json({ payment: p });
  } catch (err) {
    next(err);
  }
});

apPaymentsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ApPaymentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const p = await createApPayment(parsed.data);
    return res.status(201).json({ payment: p });
  } catch (err) {
    next(err);
  }
});

apPaymentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ApPaymentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateApPayment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'AP payment not found' });
    return res.json({ payment: updated });
  } catch (err) {
    next(err);
  }
});
