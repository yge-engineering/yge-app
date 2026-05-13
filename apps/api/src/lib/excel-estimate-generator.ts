// Generate the YGE Est_xx Excel layout from an Estimate's stored data
// blob. The parser in excel-master-tables.ts can round-trip the result.
//
// Column layout (1-indexed, matching the user's template):
//   A=# | B=Job# | C=Item | D=Category | E=Cost Code | F=Description
//   G=Qty | H=Unit | I=OT Mult | J=Unit Cost | K=Total Cost
//   L=O&P Markup | M=Bid Price | N=Notes
//
// Row layout:
//   Row 1:  Title
//   Row 2:  Company name
//   Row 3:  Job# (B) | Selected Job# (D) | project name (F) | Rate type (H) | O&P % (J)
//   Row 5:  Totals header
//   Row 6:  Direct Cost (D-E) | O&P Markup (G-I) | BID PRICE (K-L) | GM (N)
//   Row 7:  Column headers
//   Row 8+: alternating section headers + cost lines + subtotals

import * as XLSX from 'xlsx';

export interface EstimateBidItemData {
  itemNumber: string;
  description: string;
  costLines: Array<{
    category: string | null;
    costCode: string | null;
    description: string;
    quantity: number;
    unit: string;
    otMult: number;
    unitCostCents: number;
    totalCostCents: number;
    oppMarkupCents: number;
    bidPriceCents: number;
    notes: string | null;
  }>;
  subtotalDirectCents: number;
  subtotalOppCents: number;
  subtotalBidCents: number;
}

export interface EstimateWorkbookInput {
  jobNumber: string;
  projectName: string;
  rateType: string; // "PW" | "Private"
  oppPercent: number; // 0.2 = 20%
  directCostCents: number;
  oppMarkupCents: number;
  bidPriceCents: number;
  bidItems: EstimateBidItemData[];
}

function cents(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n / 100 : 0;
}

export function buildEstimateWorkbook(est: EstimateWorkbookInput): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa: unknown[][] = [];

  // Row 1: Title.
  aoa.push([`PROJECT ESTIMATE — YOUNG GENERAL ENGINEERING`]);
  // Row 2: Company.
  aoa.push(['Young General Engineering, Inc. · CSLB 1145219 · DIR 2000018967']);
  // Row 3: Job#, project name, rate type, O&P %.
  aoa.push([
    '',
    est.jobNumber,
    '',
    'Selected Job #:',
    est.jobNumber,
    est.projectName,
    'Rate:',
    est.rateType || 'PW',
    'O&P %:',
    est.oppPercent,
  ]);
  // Row 4: empty.
  aoa.push([]);
  // Row 5: Totals header.
  aoa.push([`ESTIMATE TOTALS — ${est.projectName.toUpperCase()}`]);
  // Row 6: Totals.
  const gm = est.bidPriceCents > 0
    ? est.oppMarkupCents / est.bidPriceCents
    : 0;
  aoa.push([
    '',
    '',
    '',
    'Direct Cost:',
    cents(est.directCostCents),
    '',
    'O&P Markup:',
    '',
    cents(est.oppMarkupCents),
    '',
    'BID PRICE:',
    cents(est.bidPriceCents),
    '',
    `GM: $${cents(est.oppMarkupCents).toLocaleString('en-US', { maximumFractionDigits: 0 })} (${(gm * 100).toFixed(1)}%)`,
  ]);
  // Row 7: Column headers.
  aoa.push([
    '#',
    'Job #',
    'Item',
    'Category',
    'Cost Code',
    'Description',
    'Qty',
    'Unit',
    'OT Mult',
    'Unit Cost',
    'Total Cost',
    'O&P Markup',
    'Bid Price',
    'Notes',
  ]);

  // Row 8+: bid items.
  for (const bi of est.bidItems) {
    // Section header row: column A holds the description string only;
    // parser detects this by absence of numeric Qty.
    aoa.push([`BID ITEM ${bi.itemNumber} — ${bi.description}`]);
    // Cost lines.
    for (const line of bi.costLines) {
      aoa.push([
        bi.itemNumber, // # (bid item number)
        est.jobNumber, // Job #
        '', // Item (unused for now)
        line.category ?? '',
        line.costCode ?? '',
        line.description,
        line.quantity,
        line.unit,
        line.otMult,
        cents(line.unitCostCents),
        cents(line.totalCostCents),
        cents(line.oppMarkupCents),
        cents(line.bidPriceCents),
        line.notes ?? '',
      ]);
    }
    // Subtotal row.
    aoa.push([
      '',
      '',
      '',
      '',
      '',
      `Subtotal — Bid Item ${bi.itemNumber}`,
      '',
      '',
      '',
      '',
      cents(bi.subtotalDirectCents),
      cents(bi.subtotalOppCents),
      cents(bi.subtotalBidCents),
    ]);
    // Blank spacer row between bid items.
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Column widths (best-effort — Excel respects these when opened).
  ws['!cols'] = [
    { wch: 4 }, // #
    { wch: 10 }, // Job #
    { wch: 6 }, // Item
    { wch: 16 }, // Category
    { wch: 14 }, // Cost Code
    { wch: 50 }, // Description
    { wch: 8 }, // Qty
    { wch: 6 }, // Unit
    { wch: 8 }, // OT Mult
    { wch: 12 }, // Unit Cost
    { wch: 14 }, // Total Cost
    { wch: 14 }, // O&P Markup
    { wch: 14 }, // Bid Price
    { wch: 60 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, ws, `Est_${est.jobNumber}`);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}
