// Imported estimates routes — list + read + create + patch + delete.
//
// Lifted out of the existing /estimates route (which is for the
// AI-drafted PricedEstimate model) so the two coexist.

import { Router } from 'express';
import { ImportedEstimateCreateSchema, ImportedEstimatePatchSchema } from '@yge/shared';
import {
  createImportedEstimate,
  deleteImportedEstimate,
  getImportedEstimate,
  listImportedEstimates,
  updateImportedEstimate,
} from '../lib/imported-estimates-store';

export const importedEstimatesRouter = Router();

importedEstimatesRouter.get('/', async (_req, res, next) => {
  try {
    const importedEstimates = await listImportedEstimates();
    return res.json({ importedEstimates });
  } catch (err) { next(err); }
});

importedEstimatesRouter.get('/:id', async (req, res, next) => {
  try {
    const ie = await getImportedEstimate(req.params.id);
    if (!ie) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ importedEstimate: ie });
  } catch (err) { next(err); }
});

importedEstimatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ImportedEstimateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const ie = await createImportedEstimate(parsed.data);
    return res.status(201).json({ importedEstimate: ie });
  } catch (err) { next(err); }
});

importedEstimatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ImportedEstimatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateImportedEstimate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ importedEstimate: updated });
  } catch (err) { next(err); }
});

importedEstimatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteImportedEstimate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Imported estimate not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});
