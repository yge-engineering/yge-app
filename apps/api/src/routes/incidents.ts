// Incident (OSHA 300/301) routes.

import { Router } from 'express';
import { IncidentCreateSchema, IncidentPatchSchema } from '@yge/shared';
import {
  createIncident,
  getIncident,
  listIncidents,
  updateIncident,
} from '../lib/incidents-store';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (req, res, next) => {
  try {
    const logYearParam = req.query.logYear;
    const logYear =
      typeof logYearParam === 'string' && /^\d{4}$/.test(logYearParam)
        ? Number(logYearParam)
        : undefined;
    const incidents = await listIncidents({
      logYear,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id', async (req, res, next) => {
  try {
    const i = await getIncident(req.params.id);
    if (!i) return res.status(404).json({ error: 'Incident not found' });
    return res.json({ incident: i });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = IncidentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const i = await createIncident(parsed.data);
    return res.status(201).json({ incident: i });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = IncidentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateIncident(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });
    return res.json({ incident: updated });
  } catch (err) {
    next(err);
  }
});
