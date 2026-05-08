// CSV / .xlsx import for priced estimates. Accepts both formats
// from a single endpoint; for .xlsx the caller picks which sheet
// to use via the `sheetName` field on the multipart body. When
// .xlsx is uploaded WITHOUT a sheetName, we return 422 with the
// list of sheet names so the UI can render a picker.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { createEstimateFromImport } from '../lib/estimates-store';
import type { PricedBidItem } from '@yge/shared';

export const pricedEstimatesImportRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

function rowsToItems(rows: string[][]): { items: PricedBidItem[]; summary: ParseSummary } {
  if (rows.length === 0)
    return {
      items: [],
      summary: { itemsParsed: 0, itemsSkipped: 0, skippedReasons: [] },
    };

  const firstRow = rows[0]!.map((c) => (c ?? '').toString().toLowerCase());
  const hasHeader = firstRow.some((c) =>
    /\b(item|line|description|unit|quantity|qty|price)\b/.test(c),
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const items: PricedBidItem[] = [];
  const reasons: string[] = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i]!.map((c) => (c ?? '').toString().trim());
    if (cols.every((c) => !c)) continue; // skip wholly-empty rows
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
    const qty = Number((qtyRaw ?? '').replace(/,/g, ''));
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

function parseCsv(text: string): { items: PricedBidItem[]; summary: ParseSummary } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return rowsToItems(lines.map(splitCsvLine));
}

function parseXlsxSheet(
  buffer: Buffer,
  sheetName: string,
): { items: PricedBidItem[]; summary: ParseSummary } | null {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return null;
  // Cast each cell to a string through SheetJS's `header: 1` mode so
  // we get an array-of-arrays back.
  const rowsRaw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  const rows: string[][] = rowsRaw.map((row) =>
    row.map((c) => (c == null ? '' : String(c))),
  );
  return rowsToItems(rows);
}

function listXlsxSheets(buffer: Buffer): string[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames;
}

const ImportFieldsSchema = z.object({
  jobId: z.string().min(1).max(120),
  projectName: z.string().min(1).max(200),
  oppPercent: z.string().optional(),
  sheetName: z.string().max(120).optional(),
  /** When 'true' (string from multipart form), tag each imported
   *  bid item with reviewState='accepted' so they don't pollute
   *  the editor's unreviewed counter. Default true on the UI. */
  markAllReviewed: z.string().optional(),
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

    const filename = req.file.originalname.toLowerCase();
    const isXlsx =
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xlsm') ||
      filename.endsWith('.xls') ||
      req.file.mimetype.includes('spreadsheet');

    let items: PricedBidItem[] = [];
    let summary: ParseSummary = {
      itemsParsed: 0,
      itemsSkipped: 0,
      skippedReasons: [],
    };

    if (isXlsx) {
      const sheets = listXlsxSheets(req.file.buffer);
      const wantedSheet = parsedFields.data.sheetName ?? '';
      if (!wantedSheet || !sheets.includes(wantedSheet)) {
        return res.status(422).json({
          error: 'Multi-sheet workbook — pick which sheet holds the bid items.',
          availableSheets: sheets,
        });
      }
      const out = parseXlsxSheet(req.file.buffer, wantedSheet);
      if (!out) {
        return res.status(422).json({
          error: `Sheet "${wantedSheet}" not found in workbook.`,
          availableSheets: sheets,
        });
      }
      items = out.items;
      summary = out.summary;
    } else {
      const text = req.file.buffer.toString('utf8');
      const out = parseCsv(text);
      items = out.items;
      summary = out.summary;
    }

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
    const tagReviewed = parsedFields.data.markAllReviewed === 'true';
    const finalItems = tagReviewed
      ? items.map((it) => ({ ...it, reviewState: 'accepted' as const }))
      : items;
    const estimate = await createEstimateFromImport({
      jobId: parsedFields.data.jobId,
      projectName: parsedFields.data.projectName,
      bidItems: finalItems,
      oppPercent: Number.isFinite(oppNumber) ? oppNumber : undefined,
    });

    return res.status(201).json({ estimate, summary });
  } catch (err) {
    next(err);
  }
});
