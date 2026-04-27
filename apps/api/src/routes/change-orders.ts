// Change order routes.

import { Router } from 'express';
import { ChangeOrderCreateSchema, ChangeOrderPatchSchema } from '@yge/shared';
import {
  createChangeOrder,
  getChangeOrder,
  listChangeOrders,
  updateChangeOrder,
} from '../lib/change-orders-store';

export const changeOrdersRouter = Router();

changeOrdersRouter.get('/', async (req, res, next) => {
  try {
    const changeOrders = await listChangeOrders({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ changeOrders });
  } catch (err) {
    next(err);
  }
});

changeOrdersRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await getChangeOrder(req.params.id);
    if (!c) return res.status(404).json({ error: 'Change order not found' });
    return res.json({ changeOrder: c });
  } catch (err) {
    next(err);
  }
});

changeOrdersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ChangeOrderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const c = await createChangeOrder(parsed.data);
    return res.status(201).json({ changeOrder: c });
  } catch (err) {
    next(err);
  }
});

changeOrdersRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ChangeOrderPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateChangeOrder(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Change order not found' });
    return res.json({ changeOrder: updated });
  } catch (err) {
    next(err);
  }
});
