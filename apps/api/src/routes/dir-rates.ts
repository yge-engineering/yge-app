// DIR prevailing wage rate routes.

import { Router } from 'express';
import {
  DirRateCreateSchema,
  DirRatePatchSchema,
  classificationLabel,
  csvDollars,
  totalFringeCents,
  totalPrevailingWageCents,
  type DirRate,
} from '@yge/shared';
import {
  createDirRate,
  getDirRate,
  listDirRates,
  updateDirRate,
} from '../lib/dir-rates-store';
import { maybeCsv } from '../lib/csv-response';

export const dirRatesRouter = Router();

const DIR_RATE_CSV_COLUMNS = [
  { header: 'Classification', get: (r: DirRate) => classificationLabel(r.classification) },
  { header: 'County', get: (r: DirRate) => r.county },
  { header: 'Effective', get: (r: DirRate) => r.effectiveDate },
  { header: 'Expires', get: (r: DirRate) => r.expiresOn ?? '' },
  { header: 'Basic', get: (r: DirRate) => csvDollars(r.basicHourlyCents) },
  { header: 'H&W', get: (r: DirRate) => csvDollars(r.healthAndWelfareCents) },
  { header: 'Pension', get: (r: DirRate) => csvDollars(r.pensionCents) },
  { header: 'Vac/Hol', get: (r: DirRate) => csvDollars(r.vacationHolidayCents) },
  { header: 'Training', get: (r: DirRate) => csvDollars(r.trainingCents) },
  { header: 'Other fringe', get: (r: DirRate) => csvDollars(r.otherFringeCents) },
  { header: 'Total fringe', get: (r: DirRate) => csvDollars(totalFringeCents(r)) },
  {
    header: 'Total prevailing',
    get: (r: DirRate) => csvDollars(totalPrevailingWageCents(r)),
  },
] as const;

dirRatesRouter.get('/', async (req, res, next) => {
  try {
    const rates = await listDirRates({
      classification:
        typeof req.query.classification === 'string' ? req.query.classification : undefined,
      county: typeof req.query.county === 'string' ? req.query.county : undefined,
    });
    if (maybeCsv(req, res, rates, DIR_RATE_CSV_COLUMNS, 'dir-rates')) return;
    return res.json({ rates });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.get('/:id', async (req, res, next) => {
  try {
    const r = await getDirRate(req.params.id);
    if (!r) return res.status(404).json({ error: 'DIR rate not found' });
    return res.json({ rate: r });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = DirRateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const r = await createDirRate(parsed.data);
    return res.status(201).json({ rate: r });
  } catch (err) {
    next(err);
  }
});

dirRatesRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = DirRatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateDirRate(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'DIR rate not found' });
    return res.json({ rate: updated });
  } catch (err) {
    next(err);
  }
});
