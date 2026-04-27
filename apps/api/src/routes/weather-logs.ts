// Weather log routes.

import { Router } from 'express';
import { WeatherLogCreateSchema, WeatherLogPatchSchema } from '@yge/shared';
import {
  createWeatherLog,
  getWeatherLog,
  listWeatherLogs,
  updateWeatherLog,
} from '../lib/weather-logs-store';

export const weatherLogsRouter = Router();

weatherLogsRouter.get('/', async (req, res, next) => {
  try {
    const logs = await listWeatherLogs({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
    });
    return res.json({ logs });
  } catch (err) {
    next(err);
  }
});

weatherLogsRouter.get('/:id', async (req, res, next) => {
  try {
    const w = await getWeatherLog(req.params.id);
    if (!w) return res.status(404).json({ error: 'Weather log not found' });
    return res.json({ log: w });
  } catch (err) {
    next(err);
  }
});

weatherLogsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = WeatherLogCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const w = await createWeatherLog(parsed.data);
    return res.status(201).json({ log: w });
  } catch (err) {
    next(err);
  }
});

weatherLogsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = WeatherLogPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateWeatherLog(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Weather log not found' });
    return res.json({ log: updated });
  } catch (err) {
    next(err);
  }
});
