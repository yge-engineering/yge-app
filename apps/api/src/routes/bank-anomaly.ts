// Bank-transaction anomaly scan endpoint.
//
// Plain English: bookkeeper pastes a list of recent transactions (or
// the UI feeds the parsed OFX directly), this returns a list of
// flags — duplicate charges, fee creep, unusual amounts, large
// round-number checks, new-vendor spend, weekend large debits.
//
// Stateless: nothing is persisted. The caller decides whether to
// surface flags in the audit binder.

import { Router } from 'express';
import { z } from 'zod';
import {
  BankTransactionSchema,
  bankTransactionsFromOfx,
  scanForAnomalies,
} from '@yge/shared';

export const bankAnomalyRouter = Router();

// We accept either the scanner's native shape OR an OFX-parser-shaped
// list. The two are discriminated by the presence of a positive `type`
// field (native scanner: 'DEBIT'|'CREDIT'). OFX rows carry a signed
// `amountCents` and an optional `fitId`.
const OfxLikeTxnSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  description: z.string().max(400),
  amountCents: z.number().int(),
  fitId: z.string().nullable().optional(),
  trnType: z.string().nullable().optional(),
});

const ScanRequestSchema = z
  .object({
    transactions: z
      .array(z.union([BankTransactionSchema, OfxLikeTxnSchema]))
      .min(1)
      .max(2000),
    knownMerchants: z.array(z.string().max(300)).max(2000).optional(),
    asOfDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd')
      .optional(),
  })
  .strict();

bankAnomalyRouter.post('/scan', (req, res, next) => {
  try {
    const parsed = ScanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    // Normalize: each input might already be a BankTransaction OR an
    // OFX shape — convert the OFX ones, pass through the native ones.
    const txns = parsed.data.transactions.map((t, i) => {
      if ('type' in t && 'id' in t) return t;
      const ofx = t as z.infer<typeof OfxLikeTxnSchema>;
      return bankTransactionsFromOfx([
        {
          date: ofx.date,
          description: ofx.description,
          amountCents: ofx.amountCents,
          fitId: ofx.fitId ?? null,
          trnType: ofx.trnType ?? null,
        },
      ])[0]!;
    });

    const asOfDate = parsed.data.asOfDate ?? todayIso();
    const anomalies = scanForAnomalies(txns, {
      asOfDate,
      knownMerchants: parsed.data.knownMerchants,
    });

    return res.json({
      asOfDate,
      transactionCount: txns.length,
      anomalies,
    });
  } catch (err) {
    next(err);
  }
});

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
