// Parse the master rate sheets from the YGE Job Cost System workbook.
//
// The workbook structure is documented in
// docs/EXCEL_INTEGRATION.md (added in this bundle). Each parser is
// resilient — skips malformed rows, returns what it could parse with
// a list of parse warnings.

import * as XLSX from 'xlsx';

export interface ParsedCostCode {
  code: string;
  category: string | null;
  name: string;
  rateSource: string | null;
}

export interface ParsedLaborRate {
  code: string;
  classification: string;
  baseWageCents: number;
  hwCents: number;
  pensionCents: number;
  trainingCents: number;
  otherCents: number;
  pwBurdenedCents: number;
  privateBurdenedCents: number;
  dbBurdenedCents: number;
  ibewBurdenedCents: number | null;
  notes: string | null;
  rawDirCents: number | null;
}

export interface ParsedEquipmentRate {
  code: string;
  name: string;
  bareCents: number;
  gph: number;
  fuelCentsPerHour: number;
  totalCents: number;
  unit: string;
  notes: string | null;
}

export interface ParsedEquipmentRental {
  code: string;
  name: string;
  category: string | null;
  dailyCents: number | null;
  weeklyCents: number | null;
  monthlyCents: number | null;
  source: string | null;
  notes: string | null;
}

export interface ParsedMaterial {
  code: string;
  name: string;
  unitCostCents: number;
  unit: string;
  section: string | null;
  notes: string | null;
}

export interface ParseMasterTablesResult {
  costCodes: ParsedCostCode[];
  laborRates: ParsedLaborRate[];
  equipmentRates: ParsedEquipmentRate[];
  equipmentRental: ParsedEquipmentRental[];
  materials: ParsedMaterial[];
  warnings: string[];
}

function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function maybeStr(value: unknown): string | null {
  const s = toStr(value);
  return s.length > 0 ? s : null;
}

export function parseMasterTables(bytes: Buffer): ParseMasterTablesResult {
  const wb = XLSX.read(bytes, { cellDates: true });
  const warnings: string[] = [];
  const costCodes: ParsedCostCode[] = [];
  const laborRates: ParsedLaborRate[] = [];
  const equipmentRates: ParsedEquipmentRate[] = [];
  const equipmentRental: ParsedEquipmentRental[] = [];
  const materials: ParsedMaterial[] = [];

  // Cost_Codes: header row at row 2 (1-indexed), data from row 3.
  if (wb.Sheets['Cost_Codes']) {
    const ws = wb.Sheets['Cost_Codes'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = toStr(r[0]);
      if (!code || code === 'Cost Code') continue;
      const name = toStr(r[2]);
      if (!name) {
        warnings.push(`Cost_Codes row ${i + 1}: missing description`);
        continue;
      }
      costCodes.push({
        code,
        category: maybeStr(r[1]),
        name,
        rateSource: maybeStr(r[3]),
      });
    }
  } else {
    warnings.push('Cost_Codes sheet not found');
  }

  // Labor_Rates: header at row 4 (1-indexed), data from row 5.
  if (wb.Sheets['Labor_Rates']) {
    const ws = wb.Sheets['Labor_Rates'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 4; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = toStr(r[0]);
      if (!code || code === 'Cost Code') continue;
      const classification = toStr(r[1]);
      if (!classification) continue;
      const baseWage = toCents(r[2]);
      const pw = toCents(r[7]);
      const priv = toCents(r[8]);
      const db = toCents(r[9]);
      const ibew = toCents(r[10]);
      if (baseWage === null || pw === null || priv === null || db === null) {
        warnings.push(`Labor_Rates row ${i + 1} (${code}): missing one of base/PW/priv/DB`);
        continue;
      }
      laborRates.push({
        code,
        classification,
        baseWageCents: baseWage,
        hwCents: toCents(r[3]) ?? 0,
        pensionCents: toCents(r[4]) ?? 0,
        trainingCents: toCents(r[5]) ?? 0,
        otherCents: toCents(r[6]) ?? 0,
        pwBurdenedCents: pw,
        privateBurdenedCents: priv,
        dbBurdenedCents: db,
        ibewBurdenedCents: ibew,
        notes: maybeStr(r[11]),
        rawDirCents: toCents(r[12]),
      });
    }
  }

  // Equipment_Rates: header at row 4 (1-indexed; row 3 has fuel-price meta).
  if (wb.Sheets['Equipment_Rates']) {
    const ws = wb.Sheets['Equipment_Rates'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 4; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = toStr(r[0]);
      if (!code || code === 'Cost Code') continue;
      const name = toStr(r[1]);
      const total = toCents(r[5]);
      if (!name || total === null) continue;
      equipmentRates.push({
        code,
        name,
        bareCents: toCents(r[2]) ?? 0,
        gph: typeof r[3] === 'number' ? r[3] : Number(r[3]) || 0,
        fuelCentsPerHour: toCents(r[4]) ?? 0,
        totalCents: total,
        unit: toStr(r[6]) || 'hr',
        notes: maybeStr(r[7]),
      });
    }
  }

  // Equipment_Rental: header at row 3, data from row 4.
  if (wb.Sheets['Equipment_Rental']) {
    const ws = wb.Sheets['Equipment_Rental'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = toStr(r[0]);
      if (!code || code === 'Cost Code') continue;
      const name = toStr(r[1]);
      if (!name) continue;
      equipmentRental.push({
        code,
        name,
        category: maybeStr(r[2]),
        dailyCents: toCents(r[3]),
        weeklyCents: toCents(r[4]),
        monthlyCents: toCents(r[5]),
        source: maybeStr(r[6]),
        notes: maybeStr(r[7]),
      });
    }
  }

  // Materials: header at row 3, data from row 4.
  if (wb.Sheets['Materials']) {
    const ws = wb.Sheets['Materials'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = toStr(r[0]);
      if (!code || code === 'Material Code') continue;
      const name = toStr(r[1]);
      const price = toCents(r[2]);
      if (!name || price === null) continue;
      materials.push({
        code,
        name,
        unitCostCents: price,
        unit: toStr(r[3]) || 'EA',
        section: maybeStr(r[4]),
        notes: maybeStr(r[5]),
      });
    }
  }

  return {
    costCodes,
    laborRates,
    equipmentRates,
    equipmentRental,
    materials,
    warnings,
  };
}

// -----------------------------------------------------------------
// A2: Subcontractors, Employees, Jobs
// -----------------------------------------------------------------

export interface ParsedSubcontractor {
  name: string;
  trade: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  license: string | null;
  rateNotes: string | null;
  status: string | null;
}

export interface ParsedEmployee {
  firstName: string;
  lastName: string;
  laborCostCode: string | null;
  classification: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
}

export interface ParsedJob {
  jobNumber: string;
  name: string;
  client: string | null;
  address: string | null;
  startDate: string | null;
  status: string | null;
  rateType: string | null;
  budgetLaborCents: number | null;
  budgetMaterialsCents: number | null;
  budgetEquipmentCents: number | null;
  budgetSubsCents: number | null;
  budgetOtherCents: number | null;
  totalBudgetCents: number | null;
}

export interface ParsePeopleJobsResult {
  subcontractors: ParsedSubcontractor[];
  employees: ParsedEmployee[];
  jobs: ParsedJob[];
  warnings: string[];
}

function isoFromCell(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function parsePeopleJobs(bytes: Buffer): ParsePeopleJobsResult {
  const wb = XLSX.read(bytes, { cellDates: true });
  const warnings: string[] = [];
  const subcontractors: ParsedSubcontractor[] = [];
  const employees: ParsedEmployee[] = [];
  const jobs: ParsedJob[] = [];

  // Subcontractors — header row 2 (1-indexed), data from row 3.
  if (wb.Sheets['Subcontractors']) {
    const ws = wb.Sheets['Subcontractors'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const name = toStr(r[0]);
      if (!name || name === 'Sub Name') continue;
      subcontractors.push({
        name,
        trade: maybeStr(r[1]),
        contactName: maybeStr(r[2]),
        phone: maybeStr(r[3]),
        email: maybeStr(r[4]),
        license: maybeStr(r[5]),
        rateNotes: maybeStr(r[6]),
        status: maybeStr(r[7]),
      });
    }
  } else {
    warnings.push('Subcontractors sheet missing');
  }

  // Employees — header row 2, data from row 3.
  if (wb.Sheets['Employees']) {
    const ws = wb.Sheets['Employees'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const name = toStr(r[0]);
      if (!name || name === 'Employee Name') continue;
      const parts = name.split(/\s+/);
      const firstName = parts[0] ?? name;
      const lastName = parts.slice(1).join(' ') || '—';
      const activeRaw = toStr(r[5]).toLowerCase();
      employees.push({
        firstName,
        lastName,
        laborCostCode: maybeStr(r[1]),
        classification: maybeStr(r[2]),
        phone: maybeStr(r[3]),
        email: maybeStr(r[4]),
        active: activeRaw === 'yes' || activeRaw === 'true' || activeRaw === 'active' || activeRaw === '',
        notes: maybeStr(r[6]),
      });
    }
  }

  // Jobs — header row 2, data from row 3.
  if (wb.Sheets['Jobs']) {
    const ws = wb.Sheets['Jobs'];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const jobNumber = toStr(r[0]);
      if (!jobNumber || jobNumber === 'Job #') continue;
      const name = toStr(r[1]);
      if (!name) continue;
      jobs.push({
        jobNumber,
        name,
        client: maybeStr(r[2]),
        address: maybeStr(r[3]),
        startDate: isoFromCell(r[4]),
        status: maybeStr(r[5]),
        rateType: maybeStr(r[6]),
        budgetLaborCents: toCents(r[7]),
        budgetMaterialsCents: toCents(r[8]),
        budgetEquipmentCents: toCents(r[9]),
        budgetSubsCents: toCents(r[10]),
        budgetOtherCents: toCents(r[11]),
        totalBudgetCents: toCents(r[12]),
      });
    }
  }

  return { subcontractors, employees, jobs, warnings };
}

// -----------------------------------------------------------------
// A3: Estimates (Est_xx sheets)
// -----------------------------------------------------------------

export interface ParsedCostLine {
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
}

export interface ParsedBidItem {
  itemNumber: string;
  description: string;
  costLines: ParsedCostLine[];
  subtotalDirectCents: number;
  subtotalOppCents: number;
  subtotalBidCents: number;
}

export interface ParsedEstimate {
  sheetName: string;
  jobNumber: string | null;
  projectName: string | null;
  rateType: string | null;
  oppPercent: number | null;
  directCostCents: number;
  oppMarkupCents: number;
  bidPriceCents: number;
  bidItems: ParsedBidItem[];
}

export function parseEstimates(bytes: Buffer): { estimates: ParsedEstimate[]; warnings: string[] } {
  const wb = XLSX.read(bytes, { cellDates: true });
  const warnings: string[] = [];
  const estimates: ParsedEstimate[] = [];

  for (const sheetName of wb.SheetNames) {
    if (!/^Est_/.test(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    // Row 3: Job # in col B (idx 1), project name in col F (idx 5),
    // rate type in col H (idx 7), O&P % in col J (idx 9).
    const header = rows[2] ?? [];
    const jobNumber = maybeStr(header[1]) ?? maybeStr(header[4]) ?? sheetName.replace(/^Est_/, '');
    const projectName = maybeStr(header[5]);
    const rateType = maybeStr(header[7]);
    const oppPercent = typeof header[9] === 'number' ? header[9] as number : Number(header[9]) || 0.2;

    // Row 6: Direct Cost (E=4), O&P Markup (I=8), BID PRICE (L=11).
    const totalsRow = rows[5] ?? [];
    const directCostCents = toCents(totalsRow[4]) ?? 0;
    const oppMarkupCents = toCents(totalsRow[8]) ?? 0;
    const bidPriceCents = toCents(totalsRow[11]) ?? 0;

    // Row 7 is headers. Data starts at row 8 (idx 7).
    const bidItems: ParsedBidItem[] = [];
    let currentItem: ParsedBidItem | null = null;
    let itemNumberCounter = 0;

    for (let i = 7; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const colA = toStr(r[0]);
      const colF = toStr(r[5]);

      // Section header detection: column A starts with non-digit text
      // (like "BID ITEM 1 — [Description]" or "MOBILIZATION..."), and
      // it has no numeric quantity in col G (idx 6).
      const isSectionHeader = colA.length > 4 && !/^\d+$/.test(colA) &&
        (colA.includes('BID ITEM') || /^[A-Z][A-Z\s,.\-]+/.test(colA));
      // Subtotal row: col F starts with 'Subtotal'.
      const isSubtotal = colF.toLowerCase().startsWith('subtotal');

      if (isSectionHeader) {
        if (currentItem) bidItems.push(currentItem);
        itemNumberCounter++;
        currentItem = {
          itemNumber: String(itemNumberCounter),
          description: colA.slice(0, 500),
          costLines: [],
          subtotalDirectCents: 0,
          subtotalOppCents: 0,
          subtotalBidCents: 0,
        };
        continue;
      }

      if (isSubtotal && currentItem) {
        currentItem.subtotalDirectCents = toCents(r[10]) ?? currentItem.subtotalDirectCents;
        currentItem.subtotalOppCents = toCents(r[11]) ?? currentItem.subtotalOppCents;
        currentItem.subtotalBidCents = toCents(r[12]) ?? currentItem.subtotalBidCents;
        continue;
      }

      // Otherwise it's a cost line. Skip if no description.
      const description = toStr(r[5]);
      if (!description || description === 'Description') continue;
      const qty = typeof r[6] === 'number' ? r[6] as number : Number(r[6]) || 0;
      if (qty === 0 && !toCents(r[9])) continue; // empty row

      const line: ParsedCostLine = {
        category: maybeStr(r[3]),
        costCode: maybeStr(r[4]),
        description,
        quantity: qty,
        unit: toStr(r[7]) || 'LS',
        otMult: typeof r[8] === 'number' ? r[8] as number : Number(r[8]) || 1,
        unitCostCents: toCents(r[9]) ?? 0,
        totalCostCents: toCents(r[10]) ?? 0,
        oppMarkupCents: toCents(r[11]) ?? 0,
        bidPriceCents: toCents(r[12]) ?? 0,
        notes: maybeStr(r[13]),
      };

      if (!currentItem) {
        // Cost line without a preceding section header — create a
        // synthetic catch-all section.
        itemNumberCounter++;
        currentItem = {
          itemNumber: String(itemNumberCounter),
          description: 'Uncategorized',
          costLines: [],
          subtotalDirectCents: 0,
          subtotalOppCents: 0,
          subtotalBidCents: 0,
        };
      }
      currentItem.costLines.push(line);
    }
    if (currentItem) bidItems.push(currentItem);

    if (bidItems.length === 0) {
      warnings.push(`${sheetName}: no bid items detected`);
      continue;
    }

    estimates.push({
      sheetName,
      jobNumber,
      projectName,
      rateType,
      oppPercent,
      directCostCents,
      oppMarkupCents,
      bidPriceCents,
      bidItems,
    });
  }

  return { estimates, warnings };
}


// =====================================================================
// E3a: Daily Reports parser.
// "Daily Report" sheet: row 2 is the header, data rows from row 3.
// Columns (0-indexed):
//   0 Date · 1 Day · 2 Job # · 3 Job Name · 4 Category · 5 Cost Code
//   6 Description · 7 Qty/Hrs · 8 Unit · 9 OT Mult · 10 Rate
//   11 Total Cost · 12 Employee/Vendor · 13 Notes
// =====================================================================

export interface ParsedDailyReportLine {
  date: string;        // ISO yyyy-mm-dd
  jobNumber: string;
  jobName: string | null;
  category: string | null;
  costCode: string | null;
  description: string | null;
  qtyHrs: number | null;
  unit: string | null;
  otMult: number | null;
  rateCents: number | null;
  totalCostCents: number | null;
  employeeVendor: string | null;
  notes: string | null;
}

export interface ParseDailyReportsResult {
  lines: ParsedDailyReportLine[];
  warnings: string[];
}

export function parseDailyReports(bytes: Buffer): ParseDailyReportsResult {
  const wb = XLSX.read(bytes, { cellDates: true });
  const lines: ParsedDailyReportLine[] = [];
  const warnings: string[] = [];

  const ws = wb.Sheets['Daily Report'];
  if (!ws) {
    warnings.push('Daily Report sheet missing');
    return { lines, warnings };
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
  });

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const jobNumber = toStr(r[2]);
    if (!jobNumber) continue;
    const date = isoFromCell(r[0]);
    if (!date) continue;
    const qtyRaw = toStr(r[7]);
    const qtyHrs = qtyRaw ? Number(qtyRaw) : null;
    const otMultRaw = toStr(r[9]);
    const otMult = otMultRaw ? Number(otMultRaw) : null;

    lines.push({
      date,
      jobNumber,
      jobName: maybeStr(r[3]),
      category: maybeStr(r[4]),
      costCode: maybeStr(r[5]),
      description: maybeStr(r[6]),
      qtyHrs: Number.isFinite(qtyHrs ?? NaN) ? qtyHrs : null,
      unit: maybeStr(r[8]),
      otMult: Number.isFinite(otMult ?? NaN) ? otMult : null,
      rateCents: toCents(r[10]),
      totalCostCents: toCents(r[11]),
      employeeVendor: maybeStr(r[12]),
      notes: maybeStr(r[13]),
    });
  }

  return { lines, warnings };
}

