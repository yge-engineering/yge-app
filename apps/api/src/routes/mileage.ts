// Mileage log routes.

import { Router } from 'express';
import {
  MileageEntryCreateSchema,
  MileageEntryPatchSchema,
  csvDollars,
  mileagePurposeLabel,
  reimbursementCents,
  type MileageEntry,
} from '@yge/shared';
import {
  createMileageEntry,
  getMileageEntry,
  listMileageEntries,
  updateMileageEntry,
} from '../lib/mileage-store';
import { maybeCsv } from '../lib/csv-response';

export const mileageRouter = Router();

const MILEAGE_CSV_COLUMNS = [
  { header: 'Date', get: (e: MileageEntry) => e.tripDate },
  { header: 'Employee', get: (e: MileageEntry) => e.employeeName },
  { header: 'Vehicle', get: (e: MileageEntry) => e.vehicleDescription },
  { header: 'Personal?', get: (e: MileageEntry) => (e.isPersonalVehicle ? 'Yes' : 'No') },
  { header: 'Job', get: (e: MileageEntry) => e.jobId ?? '' },
  { header: 'Purpose', get: (e: MileageEntry) => mileagePurposeLabel(e.purpose) },
  { header: 'Miles', get: (e: MileageEntry) => e.businessMiles.toFixed(1) },
  {
    header: 'IRS rate (¢/mi)',
    get: (e: MileageEntry) => (e.irsRateCentsPerMile ?? 0).toString(),
  },
  { header: 'Reimbursable', get: (e: MileageEntry) => csvDollars(reimbursementCents(e)) },
  { header: 'Reimbursed', get: (e: MileageEntry) => (e.reimbursed ? 'Yes' : 'No') },
] as const;

mileageRouter.get('/', async (req, res, next) => {
  try {
    const entries = await listMileageEntries({
      employeeId: typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      reimbursed:
        req.query.reimbursed === 'true'
          ? true
          : req.query.reimbursed === 'false'
            ? false
            : undefined,
    });
    if (maybeCsv(req, res, entries, MILEAGE_CSV_COLUMNS, 'mileage')) return;
    return res.json({ entries });
  } catch (err) {
    next(err);
  }
});

mileageRouter.get('/:id', async (req, res, next) => {
  try {
    const e = await getMileageEntry(req.params.id);
    if (!e) return res.status(404).json({ error: 'Mileage entry not found' });
    return res.json({ entry: e });
  } catch (err) {
    next(err);
  }
});

mileageRouter.post('/', async (req, res, next) => {
  try {
    const parsed = MileageEntryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const e = await createMileageEntry(parsed.data);
    return res.status(201).json({ entry: e });
  } catch (err) {
    next(err);
  }
});

mileageRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = MileageEntryPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateMileageEntry(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Mileage entry not found' });
    return res.json({ entry: updated });
  } catch (err) {
    next(err);
  }
});
