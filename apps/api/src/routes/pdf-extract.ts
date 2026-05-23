// PDF text-extraction endpoint.
//
// Plain English: someone drops a PDF on the Plans-to-Estimate page,
// the browser uploads it here, and we send it to Anthropic with a
// "give me the text" prompt. Anthropic handles both digital PDFs
// (the easy case) and scanned ones (OCR baked in), so estimators
// don't have to think about which kind they have.
//
// Why use Anthropic instead of a local pdf-parse: scanned plan sets
// are common and pdf-parse can't read those. Anthropic's document
// block does both, and we already pay for the tokens — for a 50-
// page plan set the extract is roughly a dime, and it lands the
// text the user is going to feed back to the model anyway.

import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { logger } from '../lib/logger';

export const pdfExtractRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // 25 MB cap. Most plan sets we've seen are 5-15 MB. Bigger files
  // should go through the multi-pass page where we can chunk.
  limits: { fileSize: 25 * 1024 * 1024 },
});

pdfExtractRouter.post('/extract-text', upload.single('file'), async (req, res) => {
  // Bail fast if the API key isn't configured. Returning a plain JSON
  // error means the PDF drop handler shows the real reason instead of
  // a generic "HTTP 500".
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error:
        'PDF text extraction is unavailable: ANTHROPIC_API_KEY is not set on the API. Ask Ryan to add it to the Render env vars.',
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const isPdf =
    req.file.mimetype === 'application/pdf' ||
    req.file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return res
      .status(400)
      .json({ error: 'Only PDFs are supported on this endpoint' });
  }

  const start = Date.now();
  const base64 = req.file.buffer.toString('base64');

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
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
                'Extract every word of text from this PDF, preserving page order. ' +
                'Drop watermarks, page numbers, and pure-graphic pages. ' +
                'Return plain text only — no markdown, no commentary, no headings ' +
                'except the natural ones already in the document. If the PDF is ' +
                "blank or unreadable, reply with just the word: NONE.",
            },
          ],
        },
      ],
    });

    const text = message.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const elapsedMs = Date.now() - start;
    logger.info(
      {
        filename: req.file.originalname,
        sizeBytes: req.file.size,
        elapsedMs,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        textLength: text.length,
      },
      'PDF extract completed',
    );

    if (!text || text === 'NONE') {
      return res.status(422).json({
        error:
          'The PDF appears to be blank or unreadable. Open it, copy the text, and paste it instead.',
      });
    }

    return res.json({
      text,
      filename: req.file.originalname,
      elapsedMs,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    });
  } catch (err) {
    // Capture Anthropic-specific errors with their actual status +
    // message so the user sees what went wrong instead of a generic
    // 500. Common failure modes here:
    //   - 404 'model not found' (model name typo / sunset model)
    //   - 401 / 403 (bad key, no PDF access, account suspended)
    //   - 413 (PDF too large for Anthropic — different limit than ours)
    //   - 429 (rate limit / overload)
    //   - 502/503/504 (Anthropic transient outage)
    const elapsedMs = Date.now() - start;
    const filename = req.file.originalname;
    if (err instanceof Anthropic.APIError) {
      logger.error(
        {
          filename,
          elapsedMs,
          anthropicStatus: err.status,
          anthropicMessage: err.message,
          model: DEFAULT_MODEL,
        },
        'Anthropic API error during PDF extract',
      );
      // Surface the model + status + a hint about what to check.
      const hint =
        err.status === 404
          ? ` (model '${DEFAULT_MODEL}' not found — check apps/api/src/lib/anthropic.ts)`
          : err.status === 401 || err.status === 403
            ? ` (auth failed — check ANTHROPIC_API_KEY on Render)`
            : err.status === 413
              ? ` (PDF too big for Anthropic — try a smaller file or the multi-pass page)`
              : err.status === 429
                ? ` (rate limited — wait a minute + retry)`
                : '';
      return res.status(err.status ?? 502).json({
        error: `Anthropic API error: ${err.message}${hint}`,
        model: DEFAULT_MODEL,
      });
    }
    // Unknown error — surface the real message instead of swallowing it.
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { filename, elapsedMs, err, model: DEFAULT_MODEL },
      'Unknown error during PDF extract',
    );
    return res.status(502).json({
      error: `PDF extract failed: ${msg}`,
      model: DEFAULT_MODEL,
    });
  }
});
