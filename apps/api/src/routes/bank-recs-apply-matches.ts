// Apply confirmed bank-rec matches.
//
// Plain English: the bookkeeper saw the AI's suggestions, ticked
// the ones they trust, and clicked "Apply". This endpoint flips
// AP payments to cleared=true with a clearedOn date drawn from the
// rec's statement date. AR / expense matches are recognized but
// no-op (those models don't carry a cleared flag yet).

import { Router } from 'express';
import { z } from 'zod';
import { getBankRec } from '../lib/bank-recs-store';
import { getApPayment, updateApPayment } from '../lib/ap-payments-store';

export const bankRecsApplyMatchesRouter = Router({ mergeParams: true });

const ApplyRequestSchema = z.object({
  matches: z
    .array(
      z.object({
        candidateId: z.string().min(1),
        candidateKind: z.enum(['ar_payment', 'ap_payment', 'expense', 'journal_entry']),
      }),
    )
    .min(1)
    .max(500),
  /** Override the clearance date. Defaults to the rec's statementDate. */
  clearedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd')
    .optional(),
});

bankRecsApplyMatchesRouter.post('/:id/apply-matches', async (req, res, next) => {
  try {
    const rec = await getBankRec(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Bank rec not found' });

    const parsed = ApplyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }

    const clearedOn = parsed.data.clearedOn ?? rec.statementDate;
    const apMatches = parsed.data.matches.filter(
      (m) => m.candidateKind === 'ap_payment',
    );
    const skipped: Array<{ candidateId: string; reason: string }> = [];
    let appliedAp = 0;

    for (const m of apMatches) {
      const existing = await getApPayment(m.candidateId);
      if (!existing) {
        skipped.push({ candidateId: m.candidateId, reason: 'not found' });
        continue;
      }
      if (existing.cleared) {
        skipped.push({ candidateId: m.candidateId, reason: 'already cleared' });
        continue;
      }
      await updateApPayment(m.candidateId, {
        cleared: true,
        clearedOn,
      });
      appliedAp += 1;
    }

    const noopOther = parsed.data.matches.length - apMatches.length;

    return res.json({
      appliedAp,
      noopOther,
      skipped,
      clearedOn,
    });
  } catch (err) {
    next(err);
  }
});
