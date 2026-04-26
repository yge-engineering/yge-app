// Equipment routes — heavy iron + on-road vehicles.

import { Router } from 'express';
import {
  EquipmentAssignSchema,
  EquipmentCreateSchema,
  EquipmentPatchSchema,
  MaintenanceLogEntrySchema,
} from '@yge/shared';
import { z } from 'zod';
import {
  assignEquipment,
  createEquipment,
  getEquipment,
  listEquipment,
  logMaintenance,
  returnEquipment,
  updateEquipment,
} from '../lib/equipment-store';

export const equipmentRouter = Router();

equipmentRouter.get('/', async (_req, res, next) => {
  try {
    const equipment = await listEquipment();
    return res.json({ equipment });
  } catch (err) {
    next(err);
  }
});

equipmentRouter.get('/:id', async (req, res, next) => {
  try {
    const eq = await getEquipment(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found' });
    return res.json({ equipment: eq });
  } catch (err) {
    next(err);
  }
});

equipmentRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EquipmentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const eq = await createEquipment(parsed.data);
    return res.status(201).json({ equipment: eq });
  } catch (err) {
    next(err);
  }
});

equipmentRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EquipmentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEquipment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Equipment not found' });
    return res.json({ equipment: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/assign — to a job + optional operator.
equipmentRouter.post('/:id/assign', async (req, res, next) => {
  try {
    const parsed = EquipmentAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await assignEquipment(
      req.params.id,
      parsed.data.jobId,
      parsed.data.assignedOperatorEmployeeId,
    );
    if (!updated) return res.status(404).json({ error: 'Equipment not found' });
    return res.json({ equipment: updated });
  } catch (err) {
    next(err);
  }
});

const ReturnBodySchema = z.object({
  destination: z.enum(['IN_YARD', 'IN_SERVICE', 'OUT_FOR_REPAIR']).optional(),
});

// POST /api/equipment/:id/return — back to yard / shop / repair.
equipmentRouter.post('/:id/return', async (req, res, next) => {
  try {
    const parsed = ReturnBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await returnEquipment(req.params.id, parsed.data.destination);
    if (!updated) return res.status(404).json({ error: 'Equipment not found' });
    return res.json({ equipment: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/log-service — append a maintenance entry.
equipmentRouter.post('/:id/log-service', async (req, res, next) => {
  try {
    const parsed = MaintenanceLogEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await logMaintenance(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Equipment not found' });
    return res.json({ equipment: updated });
  } catch (err) {
    next(err);
  }
});
