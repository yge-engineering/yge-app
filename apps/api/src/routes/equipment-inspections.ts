// Equipment inspections routes.

import { Router } from 'express';
import {
  EquipmentInspectionCreateSchema,
  EquipmentInspectionPatchSchema,
} from '@yge/shared';
import {
  createEquipmentInspection,
  getEquipmentInspection,
  listEquipmentInspections,
  updateEquipmentInspection,
} from '../lib/equipment-inspections-store';

export const equipmentInspectionsRouter = Router();

equipmentInspectionsRouter.get('/', async (req, res, next) => {
  try {
    const oosQ = req.query.outOfService;
    const inspections = await listEquipmentInspections({
      equipmentId:
        typeof req.query.equipmentId === 'string' ? req.query.equipmentId : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      outOfService: oosQ === 'true' ? true : oosQ === 'false' ? false : undefined,
    });
    return res.json({ inspections });
  } catch (err) {
    next(err);
  }
});

equipmentInspectionsRouter.get('/:id', async (req, res, next) => {
  try {
    const i = await getEquipmentInspection(req.params.id);
    if (!i) return res.status(404).json({ error: 'Equipment inspection not found' });
    return res.json({ inspection: i });
  } catch (err) {
    next(err);
  }
});

equipmentInspectionsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EquipmentInspectionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const i = await createEquipmentInspection(parsed.data);
    return res.status(201).json({ inspection: i });
  } catch (err) {
    next(err);
  }
});

equipmentInspectionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EquipmentInspectionPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEquipmentInspection(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Equipment inspection not found' });
    return res.json({ inspection: updated });
  } catch (err) {
    next(err);
  }
});
