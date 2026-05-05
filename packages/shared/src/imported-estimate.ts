// Imported estimate — flat structure mirroring YGE's Excel
// estimate sheets (Est_26-001, Est_26-002, etc.).
//
// Plain English: the existing PricedEstimate type is built around the
// AI Plans-to-Estimate output (BidItems with line items). Ryan's
// existing Excel estimates are organized differently: sections of
// item-numbered rows, each with category + cost code + qty + unit
// cost. Rather than force-fit those into PricedEstimate, this is a
// dedicated read-only model so we can show his existing data in the
// app today. The two models will unify when we move to Postgres.
//
// Money: every cents field is integer cents (per CLAUDE.md).
// Section grouping: a `sectionName` on each line, computed at import
// from the all-caps subhead rows in the Excel.

import { z } from 'zod';

export const ImportedEstimateLineCategorySchema = z.enum([
  'LABOR',
  'EQUIPMENT_OWNED',
  'EQUIPMENT_RENTAL',
  'MATERIAL',
  'SUBCONTRACT',
  'OTHER',
]);
export type ImportedEstimateLineCategory = z.infer<typeof ImportedEstimateLineCategorySchema>;

export const ImportedEstimateLineSchema = z.object({
  /** The Excel `#` column — groups lines into items. Same number on
   *  multiple rows means they're part of the same item. */
  itemNumber: z.number().int().nonnegative().nullable().optional(),
  /** Section header above this line, e.g. "MOBILIZATION, TRAFFIC
   *  CONTROL, SWPPP & BONDS". */
  sectionName: z.string().max(200).optional(),
  category: ImportedEstimateLineCategorySchema,
  costCode: z.string().max(40).optional(),
  description: z.string().max(1_000),
  quantity: z.number().nonnegative().default(0),
  unit: z.string().max(40).optional(),
  /** Overtime multiplier. 1 = straight time, 1.5 = OT, 2 = double. */
  otMultiplier: z.number().nonnegative().default(1),
  unitCostCents: z.number().int().nonnegative().default(0),
  /** Quantity × unit cost × OT multiplier, captured at import time
   *  from the spreadsheet so totals match the source-of-truth. */
  totalCostCents: z.number().int().nonnegative().default(0),
  oppMarkupCents: z.number().int().nonnegative().default(0),
  bidPriceCents: z.number().int().nonnegative().default(0),
  notes: z.string().max(2_000).optional(),
});
export type ImportedEstimateLine = z.infer<typeof ImportedEstimateLineSchema>;

export const ImportedEstimateRateTypeSchema = z.enum(['PW', 'Private']);
export type ImportedEstimateRateType = z.infer<typeof ImportedEstimateRateTypeSchema>;

export const ImportedEstimateSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Excel `Job #` (e.g. '26-001'). The free-form Excel-side key. */
  jobNumber: z.string().min(1).max(40),
  /** YGE Job entity id (e.g. `job-2026-...`). Set when the imported
   *  estimate has been linked to a Job in the app — that's how it
   *  shows up under /jobs/[id] alongside AI drafts + priced
   *  estimates. Optional: imported estimates can exist before a Job
   *  is created. */
  jobId: z.string().max(120).optional(),
  projectName: z.string().min(1).max(300),
  client: z.string().max(300).optional(),
  rateType: ImportedEstimateRateTypeSchema.default('PW'),
  /** O&P markup as a decimal fraction, e.g. 0.20 for 20%. */
  oppPercent: z.number().min(0).max(2).default(0.20),

  /** Direct cost ($) summed across all lines — captured at import. */
  directCostCents: z.number().int().nonnegative().default(0),
  /** O&P markup ($) — captured at import. */
  oppMarkupCents: z.number().int().nonnegative().default(0),
  /** Bid price ($) — captured at import. */
  bidPriceCents: z.number().int().nonnegative().default(0),

  /** All line items in one flat array. Order preserved from Excel. */
  lines: z.array(ImportedEstimateLineSchema).default([]),

  notes: z.string().max(8_000).optional(),
});
export type ImportedEstimate = z.infer<typeof ImportedEstimateSchema>;

export const ImportedEstimateCreateSchema = ImportedEstimateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ImportedEstimateCreate = z.infer<typeof ImportedEstimateCreateSchema>;

export const ImportedEstimatePatchSchema = ImportedEstimateCreateSchema.partial();
export type ImportedEstimatePatch = z.infer<typeof ImportedEstimatePatchSchema>;

export function newImportedEstimateId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `iest-${hex.padStart(8, '0')}`;
}

/** Group an estimate's lines by section name, preserving order. Used
 *  by the detail page to render section headers. */
export function groupLinesBySection(lines: ImportedEstimateLine[]): Array<{
  sectionName: string;
  lines: ImportedEstimateLine[];
}> {
  const out: Array<{ sectionName: string; lines: ImportedEstimateLine[] }> = [];
  let current: { sectionName: string; lines: ImportedEstimateLine[] } | null = null;
  for (const l of lines) {
    const section = l.sectionName ?? '(Uncategorized)';
    if (!current || current.sectionName !== section) {
      current = { sectionName: section, lines: [] };
      out.push(current);
    }
    current.lines.push(l);
  }
  return out;
}

/** Translate Excel category text to the enum. Forgiving — falls back
 *  to OTHER on anything we don't recognize. */
export function categoryFromExcel(raw: string | null | undefined): ImportedEstimateLineCategory {
  if (!raw) return 'OTHER';
  const norm = raw.toLowerCase().trim();
  if (norm.includes('labor')) return 'LABOR';
  if (norm.includes('equipment') && norm.includes('rental')) return 'EQUIPMENT_RENTAL';
  if (norm.includes('equipment')) return 'EQUIPMENT_OWNED';
  if (norm.includes('material')) return 'MATERIAL';
  if (norm.includes('sub')) return 'SUBCONTRACT';
  return 'OTHER';
}

/** Display label for a category. */
export function importedEstimateLineCategoryLabel(c: ImportedEstimateLineCategory): string {
  switch (c) {
    case 'LABOR': return 'Labor';
    case 'EQUIPMENT_OWNED': return 'Equipment (Owned)';
    case 'EQUIPMENT_RENTAL': return 'Equipment (Rental)';
    case 'MATERIAL': return 'Material';
    case 'SUBCONTRACT': return 'Subcontract';
    case 'OTHER': return 'Other';
  }
}
