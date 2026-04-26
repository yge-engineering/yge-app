// Tools routes — power-tool inventory + dispatch.
//
// CRUD plus two specialized actions:
//   POST /api/tools/:id/dispatch  body { assignedToEmployeeId }
//   POST /api/tools/:id/return    body { destination?: 'IN_YARD'|'IN_SHOP'|'OUT_FOR_REPAIR' }
//
// The dispatch / return endpoints exist as their own verbs (instead of
// "PATCH with status=ASSIGNED + assignedToEmployeeId") so the UI can call
// them atomically and the audit log later can record a clean event.

import { Router } from 'express';
import { z } from 'zod';
import {
  ToolCreateSchema,
  ToolDispatchSchema,
  ToolPatchSchema,
} from '@yge/shared';
import {
  assignTool,
  createTool,
  getTool,
  listTools,
  returnTool,
  updateTool,
} from '../lib/tools-store';

export const toolsRouter = Router();

// GET /api/tools — newest-first list of every tool.
toolsRouter.get('/', async (_req, res, next) => {
  try {
    const tools = await listTools();
    return res.json({ tools });
  } catch (err) {
    next(err);
  }
});

// GET /api/tools/:id — full tool record.
toolsRouter.get('/:id', async (req, res, next) => {
  try {
    const tool = await getTool(req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ tool });
  } catch (err) {
    next(err);
  }
});

// POST /api/tools — create a new tool.
toolsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ToolCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const tool = await createTool(parsed.data);
    return res.status(201).json({ tool });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tools/:id — partial update for everything except dispatch
// state. To assign or return a tool, use the dedicated endpoints below.
toolsRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = ToolPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await updateTool(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ tool: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/tools/:id/dispatch — assign tool to an employee.
toolsRouter.post('/:id/dispatch', async (req, res, next) => {
  try {
    const parsed = ToolDispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await assignTool(req.params.id, parsed.data.assignedToEmployeeId);
    if (!updated) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ tool: updated });
  } catch (err) {
    next(err);
  }
});

const ReturnBodySchema = z.object({
  destination: z.enum(['IN_YARD', 'IN_SHOP', 'OUT_FOR_REPAIR']).optional(),
});

// POST /api/tools/:id/return — return tool to yard / shop / repair.
toolsRouter.post('/:id/return', async (req, res, next) => {
  try {
    const parsed = ReturnBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const updated = await returnTool(req.params.id, parsed.data.destination);
    if (!updated) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ tool: updated });
  } catch (err) {
    next(err);
  }
});
