// Vendor routes.

import { Router } from 'express';
import { VendorCreateSchema, VendorPatchSchema } from '@yge/shared';
import {
  createVendor,
  getVendor,
  listVendors,
  updateVendor,
} from '../lib/vendors-store';

export const vendorsRouter = Router();

vendorsRouter.get('/', async (req, res, next) => {
  try {
    const vendors = await listVendors({
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });
    return res.json({ vendors });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    const v = await getVendor(req.params.id);
    if (!v) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = VendorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const v = await createVendor(parsed.data);
    return res.status(201).json({ vendor: v });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = VendorPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateVendor(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    return res.json({ vendor: updated });
  } catch (err) {
    next(err);
  }
});
