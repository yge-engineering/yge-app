import { Router } from 'express';
import {
  EquipmentServiceRecordCreateSchema,
  EquipmentServiceRecordPatchSchema,
} from '@yge/shared';
import {
  createServiceRecord,
  getServiceRecord,
  listServiceRecords,
  updateServiceRecord,
} from '../lib/equipment-service-records-store';

export const equipmentServiceRecordsRouter = Router();

equipmentServiceRecordsRouter.get('/', async (req, res, next) => {
  try {
    const records = await listServiceRecords({
      equipmentId: typeof req.query.equipmentId === 'string' ? req.query.equipmentId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      redTagged:
        req.query.redTagged === 'true'
          ? true
          : req.query.redTagged === 'false'
            ? false
            : undefined,
    });
    return res.json({ records });
  } catch (err) {
    next(err);
  }
});

equipmentServiceRecordsRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getServiceRecord(req.params.id);
    if (!r) return res.status(404).json({ error: 'Service record not found' });
    return res.json({ record: r });
  } catch (err) {
    next(err);
  }
});

equipmentServiceRecordsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EquipmentServiceRecordCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createServiceRecord(parsed.data);
    return res.status(201).json({ record: r });
  } catch (err) {
    next(err);
  }
});

equipmentServiceRecordsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EquipmentServiceRecordPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateServiceRecord(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Service record not found' });
    return res.json({ record: updated });
  } catch (err) {
    next(err);
  }
});
