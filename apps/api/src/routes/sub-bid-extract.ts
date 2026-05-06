// Sub-bid PDF quote-import endpoint.
//
// Plain English: a vendor emails over a quote PDF. Drop it in here
// and we ask Anthropic to pull out: contractor name, CSLB license,
// DIR registration, total bid amount, scope/portion-of-work. The
// §4104 editor takes the response and creates a new row pre-filled
// so the estimator just has to verify, not retype.
//
// Output is loose JSON because vendor quote PDFs vary widely. We
// validate with Zod after parsing.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { logger } from '../lib/logger';

export const subBidExtractRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // 15 MB cap — vendor quotes are normally a page or two.
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** Schema for the AI's structured output. All fields optional so
 *  a partial match still hands the estimator something to start with. */
const ExtractedQuoteSchema = z.object({
  contractorName: z.string().max(200).optional(),
  cslbLicense: z.string().max(40).optional(),
  dirRegistration: z.string().max(40).optional(),
  portionOfWork: z.string().max(500).optional(),
  bidAmountCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(1_000).optional(),
});
export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

subBidExtractRouter.post(
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
        return res.status(400).json({ error: 'PDF only on this endpoint' });
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
                  'Extract a single subcontractor quote from this PDF and return ' +
                  'JSON with these fields:\n' +
                  '  - contractorName: legal name as it appears on the quote.\n' +
                  '  - cslbLicense: California State License Board number ' +
                  '(digits only). Omit if not present.\n' +
                  '  - dirRegistration: DIR public-works registration number ' +
                  '(digits only). Omit if not present.\n' +
                  '  - portionOfWork: 1-2 sentences describing the scope, ' +
                  'plain English. Omit if unclear.\n' +
                  '  - bidAmountCents: integer cents of the total bid amount ' +
                  '(e.g. \\$12,345.67 → 1234567). Omit if not present.\n' +
                  '  - notes: any inclusions / exclusions / assumptions worth ' +
                  'capturing for the §4104 list. Keep under 800 characters.\n' +
                  '\n' +
                  'Reply with ONLY a JSON object. No commentary, no markdown ' +
                  'fences. If the PDF clearly is not a subcontractor quote, ' +
                  'reply with: { "error": "Not a sub bid" }.',
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

      // Strip code fences if the model added them despite instructions.
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({
          error:
            'AI returned non-JSON output. The PDF might not be a vendor quote.',
        });
      }
      if (
        typeof parsed === 'object' &&
        parsed != null &&
        'error' in parsed &&
        typeof (parsed as { error?: unknown }).error === 'string'
      ) {
        return res.status(422).json({ error: (parsed as { error: string }).error });
      }
      const validated = ExtractedQuoteSchema.safeParse(parsed);
      if (!validated.success) {
        return res.status(422).json({
          error: 'Could not validate extracted fields',
          issues: validated.error.issues,
        });
      }

      const elapsedMs = Date.now() - start;
      logger.info(
        {
          filename: req.file.originalname,
          sizeBytes: req.file.size,
          elapsedMs,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        'Sub-bid PDF extract completed',
      );

      return res.json({
        quote: validated.data,
        filename: req.file.originalname,
        elapsedMs,
      });
    } catch (err) {
      next(err);
    }
  },
);
