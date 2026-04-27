// Toolbox talk routes.

import { Router } from 'express';
import { ToolboxTalkCreateSchema, ToolboxTalkPatchSchema } from '@yge/shared';
import {
  createToolboxTalk,
  getToolboxTalk,
  listToolboxTalks,
  updateToolboxTalk,
} from '../lib/toolbox-talks-store';

export const toolboxTalksRouter = Router();

toolboxTalksRouter.get('/', async (req, res, next) => {
  try {
    const talks = await listToolboxTalks({
      jobId: typeof req.query.jobId === 'string' ? req.query.jobId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    return res.json({ talks });
  } catch (err) {
    next(err);
  }
});

toolboxTalksRouter.get('/:id', async (req, res, next) => {
  try {
    const t = await getToolboxTalk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Toolbox talk not found' });
    return res.json({ talk: t });
  } catch (err) {
    next(err);
  }
});

toolboxTalksRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ToolboxTalkCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const t = await createToolboxTalk(parsed.data);
    return res.status(201).json({ talk: t });
  } catch (err) {
    next(err);
  }
});

toolboxTalksRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ToolboxTalkPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateToolboxTalk(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Toolbox talk not found' });
    return res.json({ talk: updated });
  } catch (err) {
    next(err);
  }
});
