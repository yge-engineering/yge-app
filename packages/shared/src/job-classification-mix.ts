// Per-job DIR classification mix.
//
// Plain English: for one job, what's the labor breakdown by DIR
// classification? Used to compare planned (estimate) vs actual
// (CPR) crew composition, and to set apprenticeship targets per
// craft. Pure derivation off CertifiedPayroll rows.

import type { CertifiedPayroll } from './certified-payroll';
import type { DirClassification } from './employee';

export interface ClassificationMixRow {
  classification: DirClassification;
  straightHours: number;
  overtimeHours: number;
  totalHours: number;
  /** totalHours / portfolioTotal. */
  shareOfTotal: number;
  /** Sum of grossPayCents on rows with this classification. */
  grossPayCents: number;
}

export interface JobClassificationMixReport {
  jobId: string;
  cprsConsidered: number;
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalGrossPayCents: number;
  rows: ClassificationMixRow[];
}

export interface JobClassificationMixInputs {
  jobId: string;
  certifiedPayrolls: CertifiedPayroll[];
}

export function buildJobClassificationMix(
  inputs: JobClassificationMixInputs,
): JobClassificationMixReport {
  const cprs = inputs.certifiedPayrolls.filter(
    (c) => c.jobId === inputs.jobId && c.status !== 'DRAFT',
  );

  type Bucket = {
    classification: DirClassification;
    straight: number;
    overtime: number;
    grossPay: number;
  };
  const byClass = new Map<DirClassification, Bucket>();

  let totalStraight = 0;
  let totalOvertime = 0;
  let totalGrossPay = 0;

  for (const cpr of cprs) {
    for (const row of cpr.rows) {
      const b =
        byClass.get(row.classification) ??
        ({
          classification: row.classification,
          straight: 0,
          overtime: 0,
          grossPay: 0,
        } as Bucket);
      b.straight += row.straightHours ?? 0;
      b.overtime += row.overtimeHours ?? 0;
      b.grossPay += row.grossPayCents ?? 0;
      byClass.set(row.classification, b);
      totalStraight += row.straightHours ?? 0;
      totalOvertime += row.overtimeHours ?? 0;
      totalGrossPay += row.grossPayCents ?? 0;
    }
  }

  const totalHours = totalStraight + totalOvertime;

  const rows: ClassificationMixRow[] = [];
  for (const [, b] of byClass) {
    const tot = b.straight + b.overtime;
    rows.push({
      classification: b.classification,
      straightHours: round2(b.straight),
      overtimeHours: round2(b.overtime),
      totalHours: round2(tot),
      shareOfTotal: totalHours === 0 ? 0 : round4(tot / totalHours),
      grossPayCents: b.grossPay,
    });
  }
  rows.sort((a, b) => b.totalHours - a.totalHours);

  return {
    jobId: inputs.jobId,
    cprsConsidered: cprs.length,
    totalStraightHours: round2(totalStraight),
    totalOvertimeHours: round2(totalOvertime),
    totalHours: round2(totalHours),
    totalGrossPayCents: totalGrossPay,
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
