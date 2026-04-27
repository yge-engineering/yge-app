// Cert renewal calendar (12-month ahead view).
//
// Plain English: cert-watchlist already does the bucket view of
// what's expiring soon. This is the calendar lens — group renewals
// by month so the office can plan the year. Active employee certs +
// subcontractor COIs + cert-bearing employees all in one timeline.
//
// Pure derivation. Reuses cert-watchlist row builders.

import { rowsFromEmployees, rowsFromVendors, type WatchlistRow } from './cert-watchlist';
import type { Employee } from './employee';
import type { Vendor } from './vendor';

export interface CertRenewalMonth {
  /** ISO yyyy-mm. */
  month: string;
  rows: WatchlistRow[];
  count: number;
}

export interface CertRenewalCalendarReport {
  asOf: string;
  /** How many months out we expanded. */
  monthsAhead: number;
  expiredCount: number;
  /** Items expiring in the future months. */
  months: CertRenewalMonth[];
  /** Already expired items (negative daysUntilExpiry), ungrouped. */
  expired: WatchlistRow[];
  totalUpcoming: number;
}

export interface CertRenewalCalendarInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  /** Number of future months to include. Default 12. */
  monthsAhead?: number;
  employees?: Employee[];
  vendors?: Vendor[];
}

export function buildCertRenewalCalendar(
  inputs: CertRenewalCalendarInputs,
): CertRenewalCalendarReport {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const monthsAhead = inputs.monthsAhead ?? 12;
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const empRows = inputs.employees
    ? rowsFromEmployees(inputs.employees, refNow)
    : [];
  const vendorRows = inputs.vendors
    ? rowsFromVendors(inputs.vendors, refNow)
    : [];
  const all = [...empRows, ...vendorRows];

  const expired: WatchlistRow[] = [];
  const monthsMap = new Map<string, WatchlistRow[]>();

  // Compute the cutoff month label.
  const cutoff = isoMonthOffset(asOf, monthsAhead);

  for (const row of all) {
    if (row.daysUntilExpiry < 0) {
      expired.push(row);
      continue;
    }
    const month = row.expiresOn.slice(0, 7); // yyyy-mm
    if (month > cutoff) continue; // beyond window
    const list = monthsMap.get(month) ?? [];
    list.push(row);
    monthsMap.set(month, list);
  }

  // Sort expired by daysUntilExpiry asc (most overdue first).
  expired.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Sort each month's rows by date asc.
  const months: CertRenewalMonth[] = Array.from(monthsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => ({
      month,
      rows: rows.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)),
      count: rows.length,
    }));

  return {
    asOf,
    monthsAhead,
    expiredCount: expired.length,
    months,
    expired,
    totalUpcoming: months.reduce((s, m) => s + m.count, 0),
  };
}

function isoMonthOffset(asOf: string, monthsAhead: number): string {
  const t = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(t)) return asOf.slice(0, 7);
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + monthsAhead);
  return d.toISOString().slice(0, 7);
}
