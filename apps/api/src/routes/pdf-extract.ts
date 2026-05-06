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
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { logger } from '../lib/logger';

export const pdfExtractRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // 25 MB cap. Most plan sets we've seen are 5-15 MB. Bigger files
  // should go through the multi-pass page where we can chunk.
  limits: { fileSize: 25 * 1024 * 1024 },
});

pdfExtractRouter.post('/extract-text', upload.single('file'), async (req, res, next) => {
  try {
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
    next(err);
  }
});
