// PCO-to-CO conversion velocity tracker.
//
// Plain English: pco-exposure already tracks open PCOs; this looks
// at the historical conversion side — for PCOs that DID become
// executed change orders, how long did it take? Broken down by
// agency contact when known. Drives realistic schedule + cash
// expectations on new PCOs.
//
// Pure derivation. No persisted records.

import type { Pco } from './pco';

export interface PcoVelocityAgencyRow {
  agencyContact: string;
  convertedCount: number;
  meanDaysToConvert: number;
  minDaysToConvert: number;
  maxDaysToConvert: number;
  /** Sum of costImpactCents on the converted PCOs. */
  totalConvertedCents: number;
}

export interface PcoVelocityReport {
  convertedConsidered: number;
  blendedMeanDays: number;
  totalConvertedCents: number;
  byAgency: PcoVelocityAgencyRow[];
}

export interface PcoVelocityInputs {
  pcos: Pco[];
  /** Optional date range on submittedOn. */
  start?: string;
  end?: string;
}

export function buildPcoVelocityReport(
  inputs: PcoVelocityInputs,
): PcoVelocityReport {
  const { pcos, start, end } = inputs;

  const converted = pcos.filter((p) => {
    if (p.status !== 'CONVERTED_TO_CO') return false;
    if (!p.submittedOn) return false;
    if (start && p.submittedOn < start) return false;
    if (end && p.submittedOn > end) return false;
    return true;
  });

  type Bucket = {
    agencyContact: string;
    count: number;
    sumDays: number;
    minDays: number;
    maxDays: number;
    totalCents: number;
  };
  const byAgency = new Map<string, Bucket>();
  let totalSumDays = 0;
  let totalConvertedCents = 0;

  for (const p of converted) {
    const endDate =
      p.lastResponseOn ??
      (p.updatedAt ? p.updatedAt.slice(0, 10) : null);
    if (!endDate) continue;
    const days = Math.max(0, daysBetween(p.submittedOn!, endDate));
    const agency = (p.agencyContact?.trim() || 'Unknown').toString();
    const b =
      byAgency.get(agency) ??
      ({
        agencyContact: agency,
        count: 0,
        sumDays: 0,
        minDays: Number.POSITIVE_INFINITY,
        maxDays: 0,
        totalCents: 0,
      } as Bucket);
    b.count += 1;
    b.sumDays += days;
    if (days < b.minDays) b.minDays = days;
    if (days > b.maxDays) b.maxDays = days;
    b.totalCents += p.costImpactCents;
    byAgency.set(agency, b);
    totalSumDays += days;
    totalConvertedCents += p.costImpactCents;
  }

  const rows: PcoVelocityAgencyRow[] = [];
  for (const [, b] of byAgency) {
    rows.push({
      agencyContact: b.agencyContact,
      convertedCount: b.count,
      meanDaysToConvert: b.count === 0 ? 0 : Math.round(b.sumDays / b.count),
      minDaysToConvert:
        b.minDays === Number.POSITIVE_INFINITY ? 0 : b.minDays,
      maxDaysToConvert: b.maxDays,
      totalConvertedCents: b.totalCents,
    });
  }
  rows.sort((a, b) => b.meanDaysToConvert - a.meanDaysToConvert);

  return {
    convertedConsidered: converted.length,
    blendedMeanDays:
      converted.length === 0 ? 0 : Math.round(totalSumDays / converted.length),
    totalConvertedCents,
    byAgency: rows,
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
