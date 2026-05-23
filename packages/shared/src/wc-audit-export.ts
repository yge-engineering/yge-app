// Workers' Comp year-end audit export.
//
// Insurance auditors group payroll by WC class code. The auditable base is
// regular straight-time wages PLUS the straight-time portion of overtime
// hours (NOT the half-time premium). Excluding the OT premium portion is
// what saves you 5–10% on the audit when done right.
//
// Input lines are per-employee, per-period; the helper groups them.

import { z } from 'zod';

export const WcPayrollLineSchema = z.object({
  employeeId: z.string().max(120).optional(),
  employeeName: z.string().min(1).max(120),
  /** WC class code (e.g. "5474" for excavation, "5403" for carpentry). */
  wcClassCode: z.string().min(1).max(20),
  /** Year this line is for. */
  year: z.number().int().min(2000).max(3000),
  /** Regular straight-time wages in cents. */
  regularWagesCents: z.number().int().nonnegative(),
  /** Straight-time wages from OT hours, in cents (the 1× portion).
   *  This IS included in WC base. Example: 5 hours at $50/hr = $250 → 25000. */
  overtimeStraightCents: z.number().int().nonnegative().default(0),
  /** Premium portion of OT in cents (the 0.5× extra). EXCLUDED from WC base.
   *  Example: 5 hours of OT premium at $25/hr = $125 → 12500. */
  overtimePremiumCents: z.number().int().nonnegative().default(0),
});
export type WcPayrollLine = z.infer<typeof WcPayrollLineSchema>;

export interface WcClassRollup {
  wcClassCode: string;
  /** All distinct employee names that contributed. */
  employees: string[];
  totalRegularWagesCents: number;
  totalOvertimeStraightCents: number;
  totalOvertimePremiumCents: number;
  /** Auditable base = regular + OT straight (NOT premium). */
  auditableBaseCents: number;
  lineCount: number;
}

export interface WcAuditExport {
  year: number;
  rollups: WcClassRollup[];
  grandRegularWagesCents: number;
  grandOvertimeStraightCents: number;
  grandOvertimePremiumCents: number;
  grandAuditableBaseCents: number;
}

export function buildWcAuditExport(
  lines: WcPayrollLine[],
  year: number,
): WcAuditExport {
  const filtered = lines.filter((l) => l.year === year);
  const groups = new Map<string, WcClassRollup>();
  for (const l of filtered) {
    const existing = groups.get(l.wcClassCode) ?? {
      wcClassCode: l.wcClassCode,
      employees: [],
      totalRegularWagesCents: 0,
      totalOvertimeStraightCents: 0,
      totalOvertimePremiumCents: 0,
      auditableBaseCents: 0,
      lineCount: 0,
    };
    if (!existing.employees.includes(l.employeeName)) {
      existing.employees.push(l.employeeName);
    }
    existing.totalRegularWagesCents += l.regularWagesCents;
    existing.totalOvertimeStraightCents += l.overtimeStraightCents;
    existing.totalOvertimePremiumCents += l.overtimePremiumCents;
    existing.auditableBaseCents += l.regularWagesCents + l.overtimeStraightCents;
    existing.lineCount += 1;
    groups.set(l.wcClassCode, existing);
  }
  const rollups = Array.from(groups.values()).sort((a, b) =>
    a.wcClassCode.localeCompare(b.wcClassCode),
  );
  return {
    year,
    rollups,
    grandRegularWagesCents: rollups.reduce((s, r) => s + r.totalRegularWagesCents, 0),
    grandOvertimeStraightCents: rollups.reduce((s, r) => s + r.totalOvertimeStraightCents, 0),
    grandOvertimePremiumCents: rollups.reduce((s, r) => s + r.totalOvertimePremiumCents, 0),
    grandAuditableBaseCents: rollups.reduce((s, r) => s + r.auditableBaseCents, 0),
  };
}

export function wcAuditCsvRows(out: WcAuditExport): {
  headers: string[];
  rows: Array<Array<string | number>>;
} {
  return {
    headers: [
      'WC class code',
      'Employees',
      'Regular wages ($)',
      'OT straight ($)',
      'OT premium (excluded) ($)',
      'Auditable base ($)',
      'Line count',
    ],
    rows: out.rollups.map((r) => [
      r.wcClassCode,
      r.employees.join('; '),
      (r.totalRegularWagesCents / 100).toFixed(2),
      (r.totalOvertimeStraightCents / 100).toFixed(2),
      (r.totalOvertimePremiumCents / 100).toFixed(2),
      (r.auditableBaseCents / 100).toFixed(2),
      r.lineCount,
    ]),
  };
}
