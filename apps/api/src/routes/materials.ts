// Materials routes — parts inventory + stock movement ledger.

import { Router } from 'express';
import {
  MaterialCreateSchema,
  MaterialPatchSchema,
  StockMovementCreateSchema,
} from '@yge/shared';
import {
  createMaterial,
  getMaterial,
  listMaterials,
  recordMovement,
  updateMaterial,
} from '../lib/materials-store';

export const materialsRouter = Router();

materialsRouter.get('/', async (req, res, next) => {
  try {
    const materials = await listMaterials({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      belowReorder: req.query.belowReorder === 'true',
    });
    return res.json({ materials });
  } catch (err) {
    next(err);
  }
});

materialsRouter.get('/:id', async (req, res, next) => {
  try {
    const m = await getMaterial(req.params.id);
    if (!m) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: m });
  } catch (err) {
    next(err);
  }
});

materialsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = MaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const m = await createMaterial(parsed.data);
    return res.status(201).json({ material: m });
  } catch (err) {
    next(err);
  }
});

materialsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = MaterialPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateMaterial(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/:id/movement — append a stock movement.
materialsRouter.post('/:id/movement', async (req, res, next) => {
  try {
    const parsed = StockMovementCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await recordMovement(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Material not found' });
    return res.json({ material: updated });
  } catch (err) {
    next(err);
  }
});
