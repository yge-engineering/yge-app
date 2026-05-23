// Equipment-part classifier endpoint.
//
// Plain English: hands the heuristic in @yge/shared an array of
// description strings (typically AP-invoice line descriptions), gets
// back the best-guess EquipmentPartCategory for each.
//
// Stateless, no auth gate beyond the global app middleware — this is
// pure computation. Future bundle adds an AI second pass for the
// 'OTHER' rows.

import { Router } from 'express';
import { z } from 'zod';
import { classifyPart } from '@yge/shared';

export const equipmentPartClassifyRouter = Router();

const ClassifyRequestSchema = z
  .object({
    items: z
      .array(
        z.object({
          /** Optional caller-supplied id echoed back in the result row. */
          id: z.string().max(120).optional(),
          description: z.string().min(1).max(400),
          manufacturer: z.string().max(160).optional(),
        }),
      )
      .min(1)
      .max(500),
  })
  .strict();

equipmentPartClassifyRouter.post('/classify', (req, res, next) => {
  try {
    const parsed = ClassifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    const items = parsed.data.items.map((it) => ({
      id: it.id,
      description: it.description,
      category: classifyPart(it.description, it.manufacturer),
    }));
    const otherCount = items.filter((i) => i.category === 'OTHER').length;
    return res.json({
      items,
      summary: {
        total: items.length,
        classified: items.length - otherCount,
        unclassified: otherCount,
      },
    });
  } catch (err) {
    next(err);
  }
});
