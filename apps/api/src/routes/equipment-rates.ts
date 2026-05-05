// Equipment rates master routes — owned + rental rate book.

import { Router } from 'express';
import {
  EquipmentRateCreateSchema,
  EquipmentRateKindSchema,
  EquipmentRatePatchSchema,
} from '@yge/shared';
import {
  createEquipmentRate,
  deleteEquipmentRate,
  getEquipmentRate,
  listEquipmentRates,
  updateEquipmentRate,
} from '../lib/equipment-rates-store';

export const equipmentRatesRouter = Router();

equipmentRatesRouter.get('/', async (req, res, next) => {
  try {
    const kindRaw = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const kindParsed = kindRaw ? EquipmentRateKindSchema.safeParse(kindRaw) : null;
    const equipmentRates = await listEquipmentRates({
      ...(kindParsed?.success ? { kind: kindParsed.data } : {}),
    });
    return res.json({ equipmentRates });
  } catch (err) { next(err); }
});

equipmentRatesRouter.get('/:id', async (req, res, next) => {
  try {
    const er = await getEquipmentRate(req.params.id);
    if (!er) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ equipmentRate: er });
  } catch (err) { next(err); }
});

equipmentRatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = EquipmentRateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const er = await createEquipmentRate(parsed.data);
    return res.status(201).json({ equipmentRate: er });
  } catch (err) { next(err); }
});

equipmentRatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = EquipmentRatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateEquipmentRate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ equipmentRate: updated });
  } catch (err) { next(err); }
});

equipmentRatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteEquipmentRate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Equipment rate not found' });
    return res.json({ success: true });
  } catch (err) { next(err); }
});
