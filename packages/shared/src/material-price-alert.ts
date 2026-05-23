// Material price-jump alerts.
//
// material-price-history.ts already does trend analysis (STABLE /
// RISING / FALLING / VOLATILE). What it doesn't do is fire a
// per-line ALERT when a single AP invoice shows a price jump bigger
// than a threshold compared to the most-recent prior invoice for
// the same material.
//
// This module is that single-event alarm. The morning briefing pulls
// it to surface "fuel jumped 18% on Tuesday's Hat Creek delivery"
// without making the office click through trend charts to notice.
//
// Pure: takes AP lines + a threshold, returns a list of alerts.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const MaterialPurchaseSchema = z.object({
  invoiceId: z.string().min(1),
  postedOn: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  vendorName: z.string().min(1).max(200),
  /** Free-form material description from the AP line. Used as the
   *  grouping key after normalization. */
  description: z.string().min(1).max(400),
  unit: z.string().max(40).optional(),
  /** Unit price in cents. */
  unitPriceCents: z.number().int().nonnegative(),
});
export type MaterialPurchase = z.infer<typeof MaterialPurchaseSchema>;

export type MaterialPriceAlertSeverity = 'info' | 'warn' | 'critical';

export interface MaterialPriceAlert {
  /** Stable key — normalized description (lowercase, collapsed
   *  whitespace, punctuation stripped). */
  materialKey: string;
  /** Best human label — the most-frequent raw description for the
   *  bucket. */
  description: string;
  unit?: string;
  /** Most-recent purchase (the one that triggered the alert). */
  newPurchase: MaterialPurchase;
  /** Prior purchase used as the baseline. */
  priorPurchase: MaterialPurchase;
  /** (new - prior) / prior. Positive = jump up, negative = drop. */
  changePct: number;
  severity: MaterialPriceAlertSeverity;
}

export interface ScanOptions {
  /** Absolute % threshold (decimal) below which no alert fires.
   *  Default 0.15 (15%). */
  thresholdPct?: number;
  /** Threshold for the 'critical' severity bump. Default 0.30 (30%). */
  criticalThresholdPct?: number;
  /** Cap on lookback — alerts only consider purchases within this
   *  many days of each other. Default 365 (stale prior shouldn't
   *  trigger a false alert). */
  lookbackDays?: number;
}

const DEFAULT_THRESHOLD = 0.15;
const DEFAULT_CRITICAL_THRESHOLD = 0.30;
const DEFAULT_LOOKBACK_DAYS = 365;

export function scanForPriceJumps(
  purchases: MaterialPurchase[],
  options: ScanOptions = {},
): MaterialPriceAlert[] {
  const threshold = options.thresholdPct ?? DEFAULT_THRESHOLD;
  const critical = options.criticalThresholdPct ?? DEFAULT_CRITICAL_THRESHOLD;
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  if (threshold < 0) throw new Error('thresholdPct must be non-negative');

  // Group by normalized key.
  const grouped = new Map<string, MaterialPurchase[]>();
  const descByKey = new Map<string, Map<string, number>>();
  for (const p of purchases) {
    const key = normalize(p.description);
    const list = grouped.get(key) ?? [];
    list.push(p);
    grouped.set(key, list);
    const counter = descByKey.get(key) ?? new Map();
    counter.set(p.description, (counter.get(p.description) ?? 0) + 1);
    descByKey.set(key, counter);
  }

  const alerts: MaterialPriceAlert[] = [];
  for (const [key, list] of grouped.entries()) {
    list.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
    const bestDescCounter = descByKey.get(key);
    const bestDesc = pickMostFrequent(bestDescCounter) ?? list[0]!.description;
    for (let i = 1; i < list.length; i++) {
      const prior = list[i - 1]!;
      const curr = list[i]!;
      if (prior.unitPriceCents <= 0) continue;
      const daysApart = Math.abs(daysBetween(prior.postedOn, curr.postedOn));
      if (daysApart > lookbackDays) continue;
      const changePct = (curr.unitPriceCents - prior.unitPriceCents) / prior.unitPriceCents;
      if (Math.abs(changePct) < threshold) continue;
      const severity: MaterialPriceAlertSeverity =
        Math.abs(changePct) >= critical
          ? 'critical'
          : Math.abs(changePct) >= threshold * 1.5
            ? 'warn'
            : 'info';
      alerts.push({
        materialKey: key,
        description: bestDesc,
        unit: curr.unit,
        newPurchase: curr,
        priorPurchase: prior,
        changePct: round4(changePct),
        severity,
      });
    }
  }
  // Sort by severity then absolute change pct descending.
  const rank: Record<MaterialPriceAlertSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  alerts.sort((a, b) => {
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    return Math.abs(b.changePct) - Math.abs(a.changePct);
  });
  return alerts;
}

/** Filter convenience — just the alerts at or above 'warn' severity. */
export function attentionAlerts(alerts: MaterialPriceAlert[]): MaterialPriceAlert[] {
  return alerts.filter((a) => a.severity !== 'info');
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickMostFrequent(counter: Map<string, number> | undefined): string | undefined {
  if (!counter) return undefined;
  let best: string | undefined;
  let bestN = -1;
  for (const [k, n] of counter.entries()) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}
function daysBetween(a: string, b: string): number {
  return Math.floor((parseIso(b) - parseIso(a)) / (1000 * 60 * 60 * 24));
}
function round4(n: number): number {
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}
