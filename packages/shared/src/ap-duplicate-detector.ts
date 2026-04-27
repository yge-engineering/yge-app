// AP duplicate-invoice detector — bookkeeping safety net.
//
// Plain English: vendors sometimes send the same invoice twice, or a
// rep emails it AND the AP team scans the paper copy. Either way the
// AP queue ends up with two records for one bill. Without a check
// before payment, both get paid — the vendor cashes both checks and
// it's a fight to claw the second one back.
//
// This scanner reads the open AP queue and surfaces likely duplicates
// before they go out the door. Three confidence tiers:
//
//   EXACT  — same vendor + same invoice number + same total
//   HIGH   — same vendor + same total + within 7 days
//   MEDIUM — same vendor + same total + within 30 days  (or)
//            same vendor + same invoice number + different totals
//
// Pure derivation. No persisted records introduced. Skips DRAFT and
// REJECTED — those won't be paid out so a duplicate doesn't matter.

import type { ApInvoice } from './ap-invoice';

export type DuplicateConfidence = 'EXACT' | 'HIGH' | 'MEDIUM';

export interface DuplicatePair {
  /** The earlier invoice in the pair. */
  primary: Pick<
    ApInvoice,
    'id' | 'vendorName' | 'invoiceNumber' | 'invoiceDate' | 'totalCents' | 'status'
  >;
  /** The suspect duplicate (later invoiceDate, ties broken by id). */
  candidate: Pick<
    ApInvoice,
    'id' | 'vendorName' | 'invoiceNumber' | 'invoiceDate' | 'totalCents' | 'status'
  >;
  confidence: DuplicateConfidence;
  /** How many calendar days separate the two invoiceDates. */
  daysApart: number;
  /** Human-readable bullet points explaining the match. */
  reasons: string[];
}

export interface ApDuplicateScan {
  /** Number of invoices considered (excludes DRAFT + REJECTED). */
  scannedCount: number;
  pairs: DuplicatePair[];
  exactCount: number;
  highCount: number;
  mediumCount: number;
}

/** Scan a list of AP invoices for likely duplicate pairs. */
export function findApDuplicates(invoices: ApInvoice[]): ApDuplicateScan {
  const live = invoices.filter(
    (i) => i.status !== 'DRAFT' && i.status !== 'REJECTED',
  );

  // Bucket by normalized vendor name so "Acme Co." and "Acme Company"
  // collide. The duplicate hunt only ever runs within one bucket.
  const byVendor = new Map<string, ApInvoice[]>();
  for (const i of live) {
    const k = normalizeVendor(i.vendorName);
    const list = byVendor.get(k) ?? [];
    list.push(i);
    byVendor.set(k, list);
  }

  const pairs: DuplicatePair[] = [];

  for (const list of byVendor.values()) {
    list.sort((a, b) => {
      if (a.invoiceDate !== b.invoiceDate) {
        return a.invoiceDate.localeCompare(b.invoiceDate);
      }
      return a.id.localeCompare(b.id);
    });

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const pair = classifyPair(a, b);
        if (pair) pairs.push(pair);
      }
    }
  }

  // EXACT first, then HIGH, then MEDIUM. Within a tier, smaller
  // daysApart first (more suspicious).
  const tierRank: Record<DuplicateConfidence, number> = {
    EXACT: 0,
    HIGH: 1,
    MEDIUM: 2,
  };
  pairs.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return tierRank[a.confidence] - tierRank[b.confidence];
    }
    return a.daysApart - b.daysApart;
  });

  let exactCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  for (const p of pairs) {
    if (p.confidence === 'EXACT') exactCount += 1;
    else if (p.confidence === 'HIGH') highCount += 1;
    else mediumCount += 1;
  }

  return {
    scannedCount: live.length,
    pairs,
    exactCount,
    highCount,
    mediumCount,
  };
}

function classifyPair(a: ApInvoice, b: ApInvoice): DuplicatePair | null {
  const reasons: string[] = [];
  const daysApart = absDaysBetween(a.invoiceDate, b.invoiceDate);

  const sameNumber =
    !!a.invoiceNumber &&
    !!b.invoiceNumber &&
    a.invoiceNumber.trim() === b.invoiceNumber.trim();
  const sameTotal = a.totalCents === b.totalCents && a.totalCents > 0;

  let confidence: DuplicateConfidence | null = null;

  if (sameNumber && sameTotal) {
    confidence = 'EXACT';
    reasons.push(`Same invoice number "${a.invoiceNumber}"`);
    reasons.push(`Same total (${formatCents(a.totalCents)})`);
  } else if (sameNumber && !sameTotal) {
    confidence = 'MEDIUM';
    reasons.push(`Same invoice number "${a.invoiceNumber}"`);
    reasons.push(
      `Different totals (${formatCents(a.totalCents)} vs ${formatCents(b.totalCents)})`,
    );
  } else if (sameTotal) {
    if (daysApart <= 7) {
      confidence = 'HIGH';
      reasons.push(`Same total (${formatCents(a.totalCents)})`);
      reasons.push(`Invoice dates ${daysApart} day${daysApart === 1 ? '' : 's'} apart`);
    } else if (daysApart <= 30) {
      confidence = 'MEDIUM';
      reasons.push(`Same total (${formatCents(a.totalCents)})`);
      reasons.push(`Invoice dates ${daysApart} days apart`);
    }
  }

  if (!confidence) return null;

  return {
    primary: pickFields(a),
    candidate: pickFields(b),
    confidence,
    daysApart,
    reasons,
  };
}

function pickFields(
  i: ApInvoice,
): DuplicatePair['primary'] {
  return {
    id: i.id,
    vendorName: i.vendorName,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate,
    totalCents: i.totalCents,
    status: i.status,
  };
}

/** Lowercase, drop punctuation, drop legal-suffix noise so
 *  "Acme Co." and "Acme Company LLC" collide into the same bucket. */
function normalizeVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** |days(b) - days(a)|. UTC math so DST never shifts the count. */
function absDaysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.abs(Math.round((tb - ta) / (24 * 60 * 60 * 1000)));
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
