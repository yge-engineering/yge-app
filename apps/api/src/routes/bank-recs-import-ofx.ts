// OFX/QFX bank-statement import endpoint.
//
// Plain English: bookkeeper downloads OFX from their bank, drops
// the file on a bank-rec, this returns the parsed transactions
// ready to feed into the AI match panel.

import { Router } from 'express';
import multer from 'multer';
import { parseOfx } from '@yge/shared';
import { getBankRec } from '../lib/bank-recs-store';

export const bankRecsImportOfxRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

bankRecsImportOfxRouter.post(
  '/:id/import-ofx',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const rec = await getBankRec(req.params.id ?? '');
      if (!rec) return res.status(404).json({ error: 'Bank rec not found' });
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const text = req.file.buffer.toString('utf8');
      const parsed = parseOfx(text);
      if (parsed.transactions.length === 0) {
        return res.status(422).json({
          error:
            'No transactions parsed. Make sure the file is OFX or QFX format (your bank exports these for free).',
          parsed,
        });
      }
      return res.json({
        ...parsed,
        // Echo the rec context so the UI can show "imported into
        // <bankAccountLabel>" without re-fetching.
        recId: rec.id,
        bankAccountLabel: rec.bankAccountLabel,
      });
    } catch (err) {
      next(err);
    }
  },
);
