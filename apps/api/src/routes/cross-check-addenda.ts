// AI cross-check: addenda vs. bid items.
//
// Plain English: estimator logs each addendum as it lands. Click
// "Cross-check addenda" and we send Anthropic the bidItems + each
// addendum's subject and notes. The model reports "this addendum
// looks like it should affect Item X but the description still
// reads the original way" or "this addendum extends the schedule
// — make sure the bid date is updated."
//
// Output is a list of issue strings, each tagged to a bid item
// index (or null if it's a global concern). Editor renders them
// as a checklist the estimator walks through pre-bid open.

import { Router } from 'express';
import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { getEstimate } from '../lib/estimates-store';
import { logger } from '../lib/logger';

export const crossCheckAddendaRouter = Router();

const IssueSchema = z.object({
  itemIndex: z.number().int().nullable(),
  addendumNumber: z.string().max(80).optional(),
  severity: z.enum(['blocker', 'warn', 'info']).default('warn'),
  message: z.string().max(800),
});
const CrossCheckOutputSchema = z.object({
  issues: z.array(IssueSchema),
});

crossCheckAddendaRouter.post(
  '/:id/cross-check-addenda',
  async (req, res, next) => {
    try {
      const est = await getEstimate(req.params.id ?? '');
      if (!est) return res.status(404).json({ error: 'Estimate not found' });
      if (est.addenda.length === 0) {
        return res.json({ issues: [] });
      }

      const start = Date.now();
      const itemsBlock = est.bidItems
        .map(
          (it, i) =>
            `  [${i}] Item ${it.itemNumber}: "${it.description}" — ${it.quantity} ${it.unit}` +
            (it.unitPriceCents != null
              ? ` @ $${(it.unitPriceCents / 100).toFixed(2)}`
              : ' (unpriced)'),
        )
        .join('\n');
      const addendaBlock = est.addenda
        .map(
          (a) =>
            `  Addendum ${a.number}` +
            (a.dateIssued ? ` (${a.dateIssued})` : '') +
            ` — ${a.subject ?? '(no subject)'}` +
            (a.notes ? `\n      Notes: ${a.notes.slice(0, 600)}` : '') +
            (a.acknowledged ? '' : '  [NOT YET ACKNOWLEDGED]'),
        )
        .join('\n');

      const prompt =
        `You are reviewing a CA heavy-civil bid for "${est.projectName}" (type: ${est.projectType}).\n\n` +
        `Bid items:\n${itemsBlock}\n\n` +
        `Addenda the agency has issued:\n${addendaBlock}\n\n` +
        `Cross-check the addenda against the bid items. For each addendum, ` +
        `look for any inconsistency: a quantity that wasn't updated, a scope ` +
        `change that should have been added or removed, a date or schedule ` +
        `shift the estimator might have missed, missing acknowledgement on ` +
        `something material.\n\n` +
        `Reply with ONLY a JSON object of the form:\n` +
        `  {"issues":[{` +
        `"itemIndex":<int or null>,"addendumNumber":<string optional>,` +
        `"severity":"blocker"|"warn"|"info","message":"plain-English issue"` +
        `}]}\n` +
        `Use itemIndex when the issue is tied to a specific bid item; null ` +
        `when it's a global concern (e.g. bid date moved). Severity:\n` +
        `  - blocker: missing the change makes the bid non-responsive.\n` +
        `  - warn: probably matters, double-check.\n` +
        `  - info: heads-up only.\n\n` +
        `If the addenda look fully reconciled, reply with {"issues":[]}.\n` +
        `Reply with the JSON object only — no markdown fences, no commentary.`;

      const message = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
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
        return res.status(422).json({ error: 'AI returned non-JSON output' });
      }
      const validated = CrossCheckOutputSchema.safeParse(parsed);
      if (!validated.success) {
        return res
          .status(422)
          .json({ error: 'Could not validate cross-check output' });
      }
      const elapsedMs = Date.now() - start;
      logger.info(
        {
          estimateId: est.id,
          addendaCount: est.addenda.length,
          issueCount: validated.data.issues.length,
          elapsedMs,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        'Cross-check addenda completed',
      );
      return res.json({ issues: validated.data.issues, elapsedMs });
    } catch (err) {
      next(err);
    }
  },
);
