// AI extract endpoint for bid-tab PDFs.

import { Router } from 'express';
import multer from 'multer';
import { extractBidTab } from '../lib/bid-tab-extractor';
import { logger } from '../lib/logger';

export const bidTabsExtractRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

bidTabsExtractRouter.post('/extract', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const isPdf =
      req.file.mimetype === 'application/pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return res.status(400).json({ error: 'Only PDFs are supported' });
    }

    const start = Date.now();
    const out = await extractBidTab(req.file.buffer);
    const elapsedMs = Date.now() - start;

    if ('error' in out) {
      logger.warn(
        { filename: req.file.originalname, elapsedMs, reason: out.error },
        'Bid-tab extract returned error',
      );
      return res.status(422).json({ error: out.error });
    }

    logger.info(
      {
        filename: req.file.originalname,
        bidderCount: out.bidders.length,
        elapsedMs,
      },
      'Bid-tab extract OK',
    );
    return res.json(out);
  } catch (err) {
    next(err);
  }
});
