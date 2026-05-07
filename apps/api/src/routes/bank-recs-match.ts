// AI match endpoint for bank-rec reconciliation.
//
// Plain English: the bookkeeper uploads a CSV of unmatched bank-
// statement rows; this endpoint finds the best matching open AR
// payment, AP payment, or expense for each one and returns an
// answer with HIGH/MEDIUM/LOW/NONE confidence.

import { Router } from 'express';
import { z } from 'zod';
import { suggestBankRecMatches } from '../lib/bank-rec-matcher';
import {
  PROMPT_VERSION,
  type BankRecMatchInputCandidate,
} from '../lib/prompts/bank-rec-match-v1';
import { getBankRec } from '../lib/bank-recs-store';
import { listArPayments } from '../lib/ar-payments-store';
import { listApPayments } from '../lib/ap-payments-store';
import { listExpenses } from '../lib/expenses-store';

export const bankRecsMatchRouter = Router({ mergeParams: true });

const MatchRequestSchema = z.object({
  transactions: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
        description: z.string().max(400),
        amountCents: z.number().int(),
      }),
    )
    .min(1)
    .max(500),
});

bankRecsMatchRouter.post('/:id/match', async (req, res, next) => {
  try {
    const rec = await getBankRec(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Bank rec not found' });

    const parsed = MatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    // Build the candidate list. Plain-English filter: every payment /
    // expense whose date is within the statement period for this bank
    // account.
    const accountLabel = rec.bankAccountLabel;
    // BankRec only carries a closing date, not a start date. For
    // candidate filtering we look back ~60 days from the close — long
    // enough to catch in-transit checks from the prior month.
    const closeDate = rec.statementDate;
    const closeMs = Date.parse(closeDate);
    const periodStart = Number.isFinite(closeMs)
      ? new Date(closeMs - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : '0000-00-00';
    const periodEnd = closeDate ?? '9999-12-31';

    const [arPays, apPays, expenses] = await Promise.all([
      listArPayments(),
      listApPayments(),
      listExpenses(),
    ]);

    const candidates: BankRecMatchInputCandidate[] = [];
    for (const p of arPays) {
      if (p.depositAccount && p.depositAccount !== accountLabel) continue;
      const date = p.depositedOn ?? p.receivedOn;
      if (date < periodStart || date > periodEnd) continue;
      candidates.push({
        id: p.id,
        kind: 'ar_payment',
        date,
        label: p.payerName ?? `AR payment ${p.referenceNumber ?? p.id}`,
        amountCents: p.amountCents,
      });
    }
    for (const p of apPays) {
      if (p.bankAccount && p.bankAccount !== accountLabel) continue;
      if (p.paidOn < periodStart || p.paidOn > periodEnd) continue;
      candidates.push({
        id: p.id,
        kind: 'ap_payment',
        date: p.paidOn,
        label: `${p.vendorName} ${p.referenceNumber ?? ''}`.trim(),
        amountCents: p.amountCents,
      });
    }
    for (const e of expenses) {
      if (e.receiptDate < periodStart || e.receiptDate > periodEnd) continue;
      candidates.push({
        id: e.id,
        kind: 'expense',
        date: e.receiptDate,
        label: `${e.vendor} (${e.employeeName})`,
        amountCents: e.amountCents,
      });
    }

    if (candidates.length === 0) {
      // No candidates → no AI call. Save the round-trip + tokens.
      return res.json({
        matches: parsed.data.transactions.map((_, i) => ({
          transactionIdx: i,
          candidateId: null,
          candidateKind: null,
          confidence: 'NONE' as const,
          reasoning: 'No open AR/AP/expense rows in this period to match against.',
        })),
        promptVersion: PROMPT_VERSION,
        candidateCount: 0,
      });
    }

    const out = await suggestBankRecMatches({
      transactions: parsed.data.transactions,
      candidates,
    });
    if (!out) {
      return res.status(502).json({
        error: 'AI returned an unparseable response. Please retry.',
      });
    }
    return res.json({
      matches: out.matches,
      promptVersion: PROMPT_VERSION,
      candidateCount: candidates.length,
    });
  } catch (err) {
    next(err);
  }
});
