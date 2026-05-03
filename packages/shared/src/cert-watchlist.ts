// Certification expiry watchlist.
//
// Pulls every employee certification expiration date + every
// subcontractor COI expiration date into a single ranked list so
// Brook + Ryan can see what's about to lapse before a foreman finds
// out the hard way (e.g. by putting a guy with a lapsed CDL behind
// the wheel of a haul truck).
//
// Pure derivation module — no new persisted records.

import {
  certKindLabel,
  fullName,
  type Employee,
  type EmployeeCertification,
} from './employee';
import type { Vendor } from './vendor';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export type WatchlistKind = 'EMPLOYEE_CERT' | 'SUB_COI';

export type WatchlistBucket = 'EXPIRED' | 'WITHIN_30' | 'WITHIN_60' | 'WITHIN_90' | 'BEYOND';

export interface WatchlistRow {
  /** Stable identifier — concatenation of source kind + ids so React
   *  can key the row and dedupe. */
  rowId: string;
  kind: WatchlistKind;
  /** Person/vendor name on the row. */
  subjectName: string;
  /** Employee or vendor id, for deep linking. */
  subjectId: string;
  /** What's expiring (e.g. "CDL Class A", "Insurance COI"). */
  itemLabel: string;
  /** ISO yyyy-mm-dd. */
  expiresOn: string;
  /** Days until expiration. Negative when already expired. */
  daysUntilExpiry: number;
  bucket: WatchlistBucket;
  /** Optional issuer (cert) or vendor metadata for the row. */
  issuer?: string;
  /** Path to open the underlying record. */
  href: string;
}

/** Calendar-day diff that's safe across DST. */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  // Strip time-of-day to make the diff a true calendar-day count.
  const ax = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bx = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((ax - bx) / msPerDay);
}

function bucketFor(days: number): WatchlistBucket {
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'WITHIN_30';
  if (days <= 60) return 'WITHIN_60';
  if (days <= 90) return 'WITHIN_90';
  return 'BEYOND';
}

export function bucketLabel(b: WatchlistBucket, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `watchlistBucket.${b}`);
}

/** Build watchlist rows from a list of employees + their certifications. */
export function rowsFromEmployees(
  employees: Employee[],
  now: Date = new Date(),
): WatchlistRow[] {
  const rows: WatchlistRow[] = [];
  for (const e of employees) {
    if (e.status !== 'ACTIVE') continue;
    for (const cert of e.certifications) {
      if (!cert.expiresOn) continue; // lifetime certs skip
      const exp = new Date(cert.expiresOn + 'T23:59:59');
      if (Number.isNaN(exp.getTime())) continue;
      const days = daysBetween(exp, now);
      rows.push({
        rowId: `emp:${e.id}:${cert.kind}:${cert.label}`,
        kind: 'EMPLOYEE_CERT',
        subjectName: fullName(e),
        subjectId: e.id,
        itemLabel: certificationDisplayLabel(cert),
        expiresOn: cert.expiresOn,
        daysUntilExpiry: days,
        bucket: bucketFor(days),
        issuer: cert.issuer,
        href: `/crew/${e.id}`,
      });
    }
  }
  return rows;
}

/** Build watchlist rows from a list of vendors (subcontractor COIs). */
export function rowsFromVendors(
  vendors: Vendor[],
  now: Date = new Date(),
): WatchlistRow[] {
  const rows: WatchlistRow[] = [];
  for (const v of vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    if (!v.coiExpiresOn) continue;
    const exp = new Date(v.coiExpiresOn + 'T23:59:59');
    if (Number.isNaN(exp.getTime())) continue;
    const days = daysBetween(exp, now);
    rows.push({
      rowId: `sub:${v.id}:coi`,
      kind: 'SUB_COI',
      subjectName: v.dbaName ?? v.legalName,
      subjectId: v.id,
      itemLabel: 'Insurance COI',
      expiresOn: v.coiExpiresOn,
      daysUntilExpiry: days,
      bucket: bucketFor(days),
      href: `/vendors/${v.id}`,
    });
  }
  return rows;
}

function certificationDisplayLabel(cert: EmployeeCertification): string {
  if (cert.kind === 'OTHER') return cert.label;
  return cert.label && cert.label !== certKindLabel(cert.kind)
    ? `${certKindLabel(cert.kind)} (${cert.label})`
    : certKindLabel(cert.kind);
}

/** Sort: expired first, then ascending by days-until-expiry. */
export function sortWatchlistRows(rows: WatchlistRow[]): WatchlistRow[] {
  return [...rows].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

export interface WatchlistRollup {
  total: number;
  expired: number;
  within30: number;
  within60: number;
  within90: number;
  beyond90: number;
  /** Distinct people/subs who have at least one row in the EXPIRED or
   *  WITHIN_30 bucket — the foreman-blocking set. */
  immediateActionSubjects: number;
}

export function computeWatchlistRollup(rows: WatchlistRow[]): WatchlistRollup {
  let expired = 0;
  let within30 = 0;
  let within60 = 0;
  let within90 = 0;
  let beyond90 = 0;
  const immediateSubjects = new Set<string>();
  for (const r of rows) {
    switch (r.bucket) {
      case 'EXPIRED':
        expired += 1;
        immediateSubjects.add(r.subjectId);
        break;
      case 'WITHIN_30':
        within30 += 1;
        immediateSubjects.add(r.subjectId);
        break;
      case 'WITHIN_60':
        within60 += 1;
        break;
      case 'WITHIN_90':
        within90 += 1;
        break;
      case 'BEYOND':
        beyond90 += 1;
        break;
    }
  }
  return {
    total: rows.length,
    expired,
    within30,
    within60,
    within90,
    beyond90,
    immediateActionSubjects: immediateSubjects.size,
  };
}
