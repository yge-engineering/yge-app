// YGE rate-book → AI prompt context.
//
// When the company's master rate tables are populated (via the
// /api/admin/excel-import/master-tables endpoint), this helper turns
// them into a compact text block that gets prepended to the Plans-
// to-Estimate user message. The AI then prices off YGE's actual
// book instead of falling back to the generic NorCal averages
// embedded in the system prompt.
//
// Compact-by-design: we cap rows + drop low-signal fields so even a
// big rate book stays under ~3K tokens. The AI doesn't need every
// line — it needs enough anchors to recognize "this trench item maps
// to LAB-LAB-GP1 + EQP-EX-20T" and apply YGE's numbers.

import { prisma } from '@yge/db';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? 'yge-root';

function companyId(): string {
  try {
    const reqCo = getRequestCompanyId();
    if (reqCo) return reqCo;
  } catch {
    // request context not available (worker / cron); fall through
  }
  return FALLBACK_COMPANY_ID;
}

/** Round trip-friendly summary returned to the caller — counts +
 *  the formatted text block ready to inject. The counts let the
 *  caller decide whether to bother including the block at all
 *  (empty rate book → no value in the extra tokens). */
export interface YgeRateBookSummary {
  text: string;
  counts: {
    laborRates: number;
    equipmentRates: number;
    equipmentRental: number;
    materials: number;
  };
}

const MAX_ROWS_PER_TABLE = 60; // keeps each table under ~600 tokens

/** Load the company's rate tables + format as a single text block
 *  the Plans-to-Estimate prompt can splice in. Returns an empty
 *  text when no rates exist — caller can short-circuit. */
export async function loadYgeRateBookForPrompt(): Promise<YgeRateBookSummary> {
  const co = companyId();

  // Pull all four rate tables in parallel. Deleted rows skipped.
  const [labor, equipment, rentals, materials] = await Promise.all([
    prisma.laborRate.findMany({
      where: { companyId: co, deletedAt: null },
      orderBy: [{ classification: 'asc' }, { effectiveFrom: 'desc' }],
      take: MAX_ROWS_PER_TABLE,
    }),
    prisma.equipmentRate.findMany({
      where: { companyId: co, deletedAt: null },
      orderBy: { name: 'asc' },
      take: MAX_ROWS_PER_TABLE,
    }),
    prisma.equipmentRental.findMany({
      where: { companyId: co, deletedAt: null },
      orderBy: { name: 'asc' },
      take: MAX_ROWS_PER_TABLE,
    }),
    prisma.material.findMany({
      where: { companyId: co, deletedAt: null },
      orderBy: { name: 'asc' },
      take: MAX_ROWS_PER_TABLE,
    }),
  ]);

  const counts = {
    laborRates: labor.length,
    equipmentRates: equipment.length,
    equipmentRental: rentals.length,
    materials: materials.length,
  };

  if (
    counts.laborRates === 0 &&
    counts.equipmentRates === 0 &&
    counts.equipmentRental === 0 &&
    counts.materials === 0
  ) {
    return { text: '', counts };
  }

  const lines: string[] = [
    '## YGE MASTER RATE BOOK — PREFER THESE NUMBERS',
    '',
    'When a bid line maps to one of these, USE THE YGE NUMBER instead of any',
    'generic NorCal average. These are what Ryan actually pays — the more your',
    'unit prices anchor here, the closer the bid will be to actual cost.',
    '',
  ];

  if (labor.length > 0) {
    lines.push(`### Labor rates (${labor.length} crafts)`);
    lines.push('classification → base $/hr private · base $/hr PW · base $/hr Davis-Bacon');
    for (const r of labor) {
      const private$ = (r.baseCentsPrivate / 100).toFixed(2);
      const pw$ = (r.baseCentsPW / 100).toFixed(2);
      const db$ = (r.baseCentsDB / 100).toFixed(2);
      lines.push(`  ${r.classification} (${r.code}) → $${private$} · PW $${pw$} · DB $${db$}`);
    }
    lines.push('');
  }

  if (equipment.length > 0) {
    lines.push(`### Equipment internal cost rates (${equipment.length} items)`);
    lines.push('name → internal $/hr');
    for (const r of equipment) {
      lines.push(`  ${r.name} (${r.code}) → $${(r.hourlyCents / 100).toFixed(2)}/hr`);
    }
    lines.push('');
  }

  if (rentals.length > 0) {
    lines.push(`### Equipment rental rates (${rentals.length} items)`);
    lines.push('name → $/hr · $/day · $/week (whichever is set)');
    for (const r of rentals) {
      const parts: string[] = [];
      if (r.hourlyCents != null) parts.push(`$${(r.hourlyCents / 100).toFixed(2)}/hr`);
      if (r.dailyCents != null) parts.push(`$${(r.dailyCents / 100).toFixed(2)}/day`);
      if (r.weeklyCents != null) parts.push(`$${(r.weeklyCents / 100).toFixed(2)}/wk`);
      lines.push(`  ${r.name} (${r.code}) → ${parts.join(' · ') || '(no rate)'}`);
    }
    lines.push('');
  }

  if (materials.length > 0) {
    lines.push(`### Materials (${materials.length} items)`);
    lines.push('name → $/unit');
    for (const m of materials) {
      lines.push(`  ${m.name} (${m.code}) → $${(m.unitCostCents / 100).toFixed(2)}/${m.unit}`);
    }
    lines.push('');
  }

  lines.push(
    'If a bid line has NO match here, fall back to NorCal averages from the system prompt and flag the price source in `priceSourceNote` ("YGE book not loaded for this material").',
  );

  return { text: lines.join('\n'), counts };
}
