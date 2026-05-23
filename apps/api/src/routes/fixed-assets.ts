import { Router } from 'express';
import { FixedAssetCreateSchema, FixedAssetPatchSchema } from '@yge/shared';
import {
  createFixedAsset,
  getFixedAsset,
  listFixedAssets,
  updateFixedAsset,
} from '../lib/fixed-assets-store';

export const fixedAssetsRouter = Router();

fixedAssetsRouter.get('/', async (req, res, next) => {
  try {
    const assets = await listFixedAssets({
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      equipmentId: typeof req.query.equipmentId === 'string' ? req.query.equipmentId : undefined,
    });
    return res.json({ assets });
  } catch (err) {
    next(err);
  }
});

fixedAssetsRouter.get('/:id', async (req, res, next) => {
  try {
    const a = await getFixedAsset(req.params.id);
    if (!a) return res.status(404).json({ error: 'Fixed asset not found' });
    return res.json({ asset: a });
  } catch (err) {
    next(err);
  }
});

fixedAssetsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = FixedAssetCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const a = await createFixedAsset(parsed.data);
    return res.status(201).json({ asset: a });
  } catch (err) {
    next(err);
  }
});

fixedAssetsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = FixedAssetPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateFixedAsset(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Fixed asset not found' });
    return res.json({ asset: updated });
  } catch (err) {
    next(err);
  }
});
