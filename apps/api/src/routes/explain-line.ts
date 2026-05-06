// Per-line "explain this" endpoint.
//
// Plain English: estimator clicks the ❓ button on a bid row and we
// ask Anthropic to explain what the line covers, what typically
// rolls into the unit price for it (labor / equipment / materials
// at a hand-wave level), and any heads-up the estimator should
// double-check (productivity, prevailing-wage class, common subs).
//
// Bounded request — we send the bid item's description, unit,
// quantity, current unit price (if any), the project type, the
// project name, and the calculated buildup unit price (if a
// buildup exists). No full estimate context — that would balloon
// the prompt for marginal value.

import { Router } from 'express';
import { z } from 'zod';
import {
  buildupUnitPriceCents,
  totalFringeCents,
} from '@yge/shared';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { getEstimate } from '../lib/estimates-store';

export const explainLineRouter = Router();

const ExplainBody = z.object({
  // Optional — caller can override the calc unit price hint when
  // it's mid-edit and the persisted unit price is stale.
  currentUnitCentsHint: z.number().int().nonnegative().optional(),
});

explainLineRouter.post(
  '/:id/items/:itemIndex/explain',
  async (req, res, next) => {
    try {
      const itemIndex = Number.parseInt(req.params.itemIndex ?? '', 10);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        return res.status(400).json({ error: 'Bad item index' });
      }
      const parsed = ExplainBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'Validation failed', issues: parsed.error.issues });
      }
      const est = await getEstimate(req.params.id ?? '');
      if (!est) return res.status(404).json({ error: 'Estimate not found' });
      const item = est.bidItems[itemIndex];
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const calc =
        item.costBuildup != null
          ? buildupUnitPriceCents(item.costBuildup, item.quantity)
          : null;
      const totalFringeNote = item.costBuildup
        ? item.costBuildup.labor
            .filter((l) => l.classification.trim())
            .map(
              (l) =>
                `${l.classification}: $${(l.hourlyRateCents / 100).toFixed(2)}/hr base + $${(l.fringeRateCents / 100).toFixed(2)}/hr fringe`,
            )
            .join('; ')
        : '';
      // Including the buildup classifications gives the model concrete
      // facts to anchor on instead of inventing rates.
      void totalFringeCents; // silences TS unused if buildup empty

      const userBlock = [
        `Project: ${est.projectName} (type: ${est.projectType}).`,
        `Bid item ${item.itemNumber}: "${item.description}".`,
        `Quantity: ${item.quantity} ${item.unit}.`,
        item.unitPriceCents != null
          ? `Current unit price: $${(item.unitPriceCents / 100).toFixed(2)} per ${item.unit}.`
          : 'No unit price entered yet.',
        parsed.data.currentUnitCentsHint != null
          ? `(Estimator is currently editing this to: $${(
              parsed.data.currentUnitCentsHint / 100
            ).toFixed(2)}.)`
          : '',
        calc != null
          ? `Calculated unit price from the buildup: $${(calc / 100).toFixed(2)}.`
          : '',
        totalFringeNote ? `Buildup labor classes: ${totalFringeNote}.` : '',
        item.confidence
          ? `AI confidence on the original draft of this line: ${item.confidence}.`
          : '',
        '',
        'In 3-4 short bullet points, plain English, explain:',
        '  1. What this bid item typically covers (scope / inclusions).',
        '  2. What ordinarily rolls into the unit price (labor / equipment / materials / subs).',
        '  3. Any common gotchas the estimator should double-check on a CA heavy-civil bid.',
        '  4. (only if applicable) Why the current price might be reasonable or unusual given the quantity.',
        'Be concise. Do not invent a specific dollar amount; speak in ranges or "depends on" terms.',
      ]
        .filter(Boolean)
        .join('\n');

      const message = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: userBlock }],
      });
      const text = message.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      return res.json({
        explanation: text,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
