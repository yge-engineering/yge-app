// AR payment routes.

import { Router } from 'express';
import {
  ArPaymentCreateSchema,
  ArPaymentPatchSchema,
  arPaymentKindLabel,
  arPaymentMethodLabel,
  csvDollars,
  type ArPayment,
} from '@yge/shared';
import {
  createArPayment,
  getArPayment,
  listArPayments,
  updateArPayment,
} from '../lib/ar-payments-store';
import { maybeCsv } from '../lib/csv-response';

export const arPaymentsRouter = Router();

const AR_PAYMENT_CSV_COLUMNS = [
  { header: 'Received', get: (p: ArPayment) => p.receivedOn },
  { header: 'Job', get: (p: ArPayment) => p.jobId },
  { header: 'Invoice', get: (p: ArPayment) => p.arInvoiceId },
  { header: 'Kind', get: (p: ArPayment) => arPaymentKindLabel(p.kind) },
  { header: 'Method', get: (p: ArPayment) => arPaymentMethodLabel(p.method) },
  { header: 'Reference', get: (p: ArPayment) => p.referenceNumber ?? '' },
  { header: 'Payer', get: (p: ArPayment) => p.payerName ?? '' },
  { header: 'Deposit account', get: (p: ArPayment) => p.depositAccount ?? '' },
  { header: 'Deposited', get: (p: ArPayment) => p.depositedOn ?? '' },
  { header: 'Amount', get: (p: ArPayment) => csvDollars(p.amountCents) },
] as const;

arPaymentsRouter.get('/', async (req, res, next) => {
  try {
    const payments = await listArPayments({
      arInvoiceId:
        typeof req.query.arInvoiceId === 'string' ? req.query.arInvoiceId : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    if (maybeCsv(req, res, payments, AR_PAYMENT_CSV_COLUMNS, 'ar-payments')) return;
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
