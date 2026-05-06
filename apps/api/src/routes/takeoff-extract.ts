// Plan-set takeoff extraction.
//
// Plain English: estimator picks a plan-set PDF for a specific
// bid item line. We send Anthropic the PDF + the line's description
// + unit, and ask it to find the takeoff number. Reply: { quantity,
// reasoning, pageRef? }. The editor confirms before applying.
//
// Bound carefully. The model often hallucinates if pushed to give
// a number when nothing is in the document, so the prompt makes
// "I don't know" the explicit fallback.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { logger } from '../lib/logger';

export const takeoffExtractRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // 50 MB cap — plan sets can be larger than vendor quotes.
  limits: { fileSize: 50 * 1024 * 1024 },
});

const TakeoffOutputSchema = z.object({
  quantity: z.number().nullable(),
  reasoning: z.string().max(2_000).optional(),
  pageRef: z.string().max(80).optional(),
});

takeoffExtractRouter.post(
  '/extract',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const isPdf =
        req.file.mimetype === 'application/pdf' ||
        req.file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        return res.status(400).json({ error: 'PDF only' });
      }
      const description =
        typeof req.body?.description === 'string'
          ? req.body.description.trim()
          : '';
      const unit =
        typeof req.body?.unit === 'string' ? req.body.unit.trim() : '';
      if (!description || !unit) {
        return res
          .status(400)
          .json({ error: 'description and unit are required' });
      }

      const start = Date.now();
      const base64 = req.file.buffer.toString('base64');
      const message = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text:
                  `You are reading a heavy-civil plan set or RFP PDF.\n` +
                  `Find the takeoff for this specific bid item:\n` +
                  `  Description: "${description}"\n` +
                  `  Unit: ${unit}\n\n` +
                  'Return ONLY a JSON object with these fields:\n' +
                  '  - quantity: number (in the unit above) or null if not found.\n' +
                  '  - pageRef: short page or sheet reference (e.g. "Sheet C-3" or "Page 12 of bid schedule"). Omit if not applicable.\n' +
                  '  - reasoning: 1-2 sentences plain English on how you arrived at the number, or why you returned null.\n\n' +
                  'Important rules:\n' +
                  '  - If the document does not clearly contain this scope, return ' +
                  '`quantity: null` and explain in reasoning. DO NOT GUESS.\n' +
                  '  - If multiple values match, sum them and note that in reasoning.\n' +
                  '  - Reply with the JSON object only — no markdown fences, no commentary.',
              },
            ],
          },
        ],
      });

      const raw = message.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({
          error: 'AI returned non-JSON output. Try a different page range.',
        });
      }
      const validated = TakeoffOutputSchema.safeParse(parsed);
      if (!validated.success) {
        return res.status(422).json({
          error: 'Could not validate takeoff output',
          issues: validated.error.issues,
        });
      }
      const elapsedMs = Date.now() - start;
      logger.info(
        {
          filename: req.file.originalname,
          sizeBytes: req.file.size,
          description: description.slice(0, 80),
          unit,
          elapsedMs,
          quantity: validated.data.quantity,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        'Takeoff extract completed',
      );
      return res.json({
        ...validated.data,
        filename: req.file.originalname,
        elapsedMs,
      });
    } catch (err) {
      next(err);
    }
  },
);
