// CSV import for priced estimates. Pairs with bundle 1446's
// `+ Add line` UX; this is the bulk-load companion.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createEstimateFromImport } from '../lib/estimates-store';
import type { PricedBidItem } from '@yge/shared';

export const pricedEstimatesImportRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface ParseSummary {
  itemsParsed: number;
  itemsSkipped: number;
  skippedReasons: string[];
}

function parseCurrencyToCents(s: string): number | null {
  const cleaned = s.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const negative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const stripped = negative ? cleaned.slice(1, -1) : cleaned;
  const num = Number(stripped);
  if (!Number.isFinite(num)) return null;
  const cents = Math.round(num * 100);
  return negative ? -cents : cents;
}

function splitCsvLine(line: string): string[] {
  // Tiny CSV reader — handles quoted fields with embedded commas
  // ("Knife River, Inc.") but no escaped quotes (rare in bid lines).
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (ch === '"' && inQuotes) {
      inQuotes = false;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCsv(text: string): { items: PricedBidItem[]; summary: ParseSummary } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0)
    return {
      items: [],
      summary: { itemsParsed: 0, itemsSkipped: 0, skippedReasons: [] },
    };

  // Detect a header row: first row mentions "item" or "description".
  const firstLower = lines[0]!.toLowerCase();
  const hasHeader =
    /\b(item|line|description|unit|quantity|qty|price)\b/.test(firstLower);
  const dataRows = hasHeader ? lines.slice(1) : lines;

  const items: PricedBidItem[] = [];
  const reasons: string[] = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const cols = splitCsvLine(dataRows[i]!);
    if (cols.length < 4) {
      skipped += 1;
      reasons.push(`row ${i + 1}: needs at least 4 columns (item, description, unit, qty)`);
      continue;
    }
    const [itemNumber, description, unit, qtyRaw, priceRaw] = cols;
    if (!itemNumber || !description || !unit) {
      skipped += 1;
      reasons.push(`row ${i + 1}: empty itemNumber / description / unit`);
      continue;
    }
    const qty = Number(qtyRaw?.replace(/,/g, '') ?? '');
    if (!Number.isFinite(qty) || qty < 0) {
      skipped += 1;
      reasons.push(`row ${i + 1}: invalid quantity "${qtyRaw}"`);
      continue;
    }
    const unitPriceCents =
      priceRaw && priceRaw.length > 0 ? parseCurrencyToCents(priceRaw) : null;
    items.push({
      itemNumber: String(itemNumber).slice(0, 20),
      description: String(description).slice(0, 500),
      unit: String(unit).slice(0, 20),
      quantity: qty,
      confidence: 'HIGH',
      unitPriceCents: unitPriceCents,
    });
  }

  return {
    items,
    summary: {
      itemsParsed: items.length,
      itemsSkipped: skipped,
      skippedReasons: reasons.slice(0, 5),
    },
  };
}

const ImportFieldsSchema = z.object({
  jobId: z.string().min(1).max(120),
  projectName: z.string().min(1).max(200),
  oppPercent: z.string().optional(),
});

pricedEstimatesImportRouter.post('/import-csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const parsedFields = ImportFieldsSchema.safeParse(req.body);
    if (!parsedFields.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: parsedFields.error.issues,
      });
    }
    const text = req.file.buffer.toString('utf8');
    const { items, summary } = parseCsv(text);
    if (items.length === 0) {
      return res.status(422).json({
        error:
          'No bid items parsed. Expected columns: itemNumber, description, unit, quantity, unitPrice (optional). The first row can be a header.',
        summary,
      });
    }

    const oppNumber = parsedFields.data.oppPercent
      ? Number(parsedFields.data.oppPercent)
      : undefined;
    const estimate = await createEstimateFromImport({
      jobId: parsedFields.data.jobId,
      projectName: parsedFields.data.projectName,
      bidItems: items,
      oppPercent: Number.isFinite(oppNumber) ? oppNumber : undefined,
    });

    return res.status(201).json({ estimate, summary });
  } catch (err) {
    next(err);
  }
});
