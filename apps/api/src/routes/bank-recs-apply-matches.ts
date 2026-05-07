// Apply confirmed bank-rec matches.
//
// Plain English: the bookkeeper saw the AI's suggestions, ticked
// the ones they trust, and clicked "Apply". This endpoint flips
// AP / AR payments + expenses to cleared=true with a clearedOn
// date drawn from the rec's statement date.

import { Router } from 'express';
import { z } from 'zod';
import { getBankRec } from '../lib/bank-recs-store';
import { getApPayment, updateApPayment } from '../lib/ap-payments-store';
import { getArPayment, updateArPayment } from '../lib/ar-payments-store';
import { getExpense, updateExpense } from '../lib/expenses-store';

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
    const skipped: Array<{ candidateId: string; reason: string }> = [];
    let appliedAp = 0;
    let appliedAr = 0;
    let appliedExpense = 0;
    let appliedJournalEntry = 0;

    for (const m of parsed.data.matches) {
      if (m.candidateKind === 'ap_payment') {
        const existing = await getApPayment(m.candidateId);
        if (!existing) {
          skipped.push({ candidateId: m.candidateId, reason: 'ap not found' });
          continue;
        }
        if (existing.cleared) {
          skipped.push({ candidateId: m.candidateId, reason: 'ap already cleared' });
          continue;
        }
        await updateApPayment(m.candidateId, { cleared: true, clearedOn });
        appliedAp += 1;
      } else if (m.candidateKind === 'ar_payment') {
        const existing = await getArPayment(m.candidateId);
        if (!existing) {
          skipped.push({ candidateId: m.candidateId, reason: 'ar not found' });
          continue;
        }
        if (existing.cleared) {
          skipped.push({ candidateId: m.candidateId, reason: 'ar already cleared' });
          continue;
        }
        await updateArPayment(m.candidateId, { cleared: true, clearedOn });
        appliedAr += 1;
      } else if (m.candidateKind === 'expense') {
        const existing = await getExpense(m.candidateId);
        if (!existing) {
          skipped.push({ candidateId: m.candidateId, reason: 'expense not found' });
          continue;
        }
        if (existing.cleared) {
          skipped.push({ candidateId: m.candidateId, reason: 'expense already cleared' });
          continue;
        }
        await updateExpense(m.candidateId, { cleared: true, clearedOn });
        appliedExpense += 1;
      } else {
        // journal_entry — no cleared flag yet; count as no-op.
        appliedJournalEntry += 0;
        skipped.push({
          candidateId: m.candidateId,
          reason: 'journal entries have no cleared flag',
        });
      }
    }

    return res.json({
      appliedAp,
      appliedAr,
      appliedExpense,
      appliedJournalEntry,
      // Backwards compat: noopOther was the v1 field name when
      // only AP was applicable; keep it pointing at the journal-
      // entry skip count.
      noopOther: appliedJournalEntry,
      skipped,
      clearedOn,
    });
  } catch (err) {
    next(err);
  }
});
