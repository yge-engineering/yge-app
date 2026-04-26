// AP invoice routes — vendor bills.

import { Router } from 'express';
import {
  ApInvoiceApproveSchema,
  ApInvoiceCreateSchema,
  ApInvoicePatchSchema,
  ApInvoicePaySchema,
  ApInvoiceRejectSchema,
} from '@yge/shared';
import {
  approveApInvoice,
  createApInvoice,
  getApInvoice,
  listApInvoices,
  payApInvoice,
  rejectApInvoice,
  updateApInvoice,
} from '../lib/ap-invoices-store';

export const apInvoicesRouter = Router();

apInvoicesRouter.get('/', async (req, res, next) => {
  try {
    const invoices = await listApInvoices({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const inv = await getApInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ApInvoiceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const inv = await createApInvoice(parsed.data);
    return res.status(201).json({ invoice: inv });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ApInvoicePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateApInvoice(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const parsed = ApInvoiceApproveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await approveApInvoice(
      req.params.id,
      parsed.data.approvedByEmployeeId,
    );
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/pay', async (req, res, next) => {
  try {
    const parsed = ApInvoicePaySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await payApInvoice(
      req.params.id,
      parsed.data.paidAt,
      parsed.data.paymentMethod,
      parsed.data.paymentReference,
      parsed.data.amountCents,
    );
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});

apInvoicesRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const parsed = ApInvoiceRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await rejectApInvoice(req.params.id, parsed.data.reason);
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ invoice: updated });
  } catch (err) {
    next(err);
  }
});
