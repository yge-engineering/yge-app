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
