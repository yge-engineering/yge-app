// Safety library — version-controlled documents (IIPP, heat illness,
// haz-comm, respiratory protection, SDS, EHS programs).
//
// Per the v6.3 gap analysis (Phase 4): "Safety library (IIPP / heat
// illness / SDS, version-controlled viewer)" was unbuilt. The existing
// documents store treats files as flat blobs; safety documents need a
// proper version chain so the foreman knows which IIPP was effective on
// the date of an incident.
//
// This module is the shape + the lookup helpers. File storage stays in
// the existing documents pipeline; this layer threads a `documentId` +
// `versionLabel` + effective-date interval over those files.
//
// Why versioning matters for safety docs specifically:
//   - Cal/OSHA T8 §3203 (IIPP) requires the EMPLOYER to maintain the
//     written program "in effect at the time of the violation". If the
//     IIPP changed mid-year, an audit needs the version that was in
//     force on the incident date, not today's version.
//   - SDS files change frequently as the manufacturer revises the data
//     sheet. The version that was on hand when the worker was exposed
//     is the relevant one.
//   - Heat illness plan, haz-comm program, EHS program — same logic.
//
// Pure derivation. No DB.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SafetyDocKindSchema = z.enum([
  'IIPP', // Injury & Illness Prevention Program — Cal/OSHA §3203
  'HEAT_ILLNESS_PLAN', // §3395
  'HAZ_COMM_PROGRAM', // §5194
  'RESPIRATORY_PROTECTION_PROGRAM', // §5144
  'CONFINED_SPACE_PROGRAM',
  'CONTROL_OF_HAZ_ENERGY_LOTO', // §3314
  'EHS_PROGRAM', // generic environmental health + safety
  'SDS', // safety data sheet for a single product
  'OTHER',
]);
export type SafetyDocKind = z.infer<typeof SafetyDocKindSchema>;

export const SafetyDocumentSchema = z.object({
  id: z.string().min(1),
  kind: SafetyDocKindSchema,
  /** Human title — e.g. "Cottonwood Yard IIPP" or "Acme Asphalt SDS". */
  title: z.string().min(1).max(300),
  /** Optional jurisdiction tag — drives which audit rules apply. */
  jurisdiction: z.enum(['CA', 'FEDERAL', 'BOTH']).default('CA'),
  /** Optional product / SDS identifier when kind === 'SDS'. */
  productIdentifier: z.string().max(200).optional(),
  /** Free-form internal notes. */
  notes: z.string().max(2000).optional(),
});
export type SafetyDocument = z.infer<typeof SafetyDocumentSchema>;

export const SafetyDocumentVersionSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  /** Short label that prints in the version-history table: e.g. "v3",
   *  "Rev 2026-02", "2024 update". Free-form. */
  versionLabel: z.string().min(1).max(60),
  /** First date this version is the "in-effect" one (yyyy-mm-dd). */
  effectiveOn: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Date this version stops being current. Usually equals the next
   *  version's effectiveOn. Open-ended (null) means it's the current. */
  supersededOn: z.string().regex(ISO_DATE).optional(),
  /** What changed — printed next to the version label. */
  summary: z.string().min(1).max(2000),
  /** Stub for the doc-vault URL. */
  fileUrl: z.string().max(800).optional(),
  /** Optional integrity hash so old versions can't be silently swapped. */
  sha256: z.string().length(64).optional(),
  uploadedBy: z.string().max(200).optional(),
});
export type SafetyDocumentVersion = z.infer<typeof SafetyDocumentVersionSchema>;

/** Returns the version that was in effect on `asOfDate` for a single
 *  document, or `null` if no version was effective by then. */
export function currentVersionAt(
  versions: SafetyDocumentVersion[],
  asOfDate: string,
): SafetyDocumentVersion | null {
  let best: SafetyDocumentVersion | null = null;
  for (const v of versions) {
    if (v.effectiveOn > asOfDate) continue;
    if (v.supersededOn && v.supersededOn <= asOfDate) continue;
    if (!best || v.effectiveOn > best.effectiveOn) best = v;
  }
  return best;
}

/** All versions in chronological order (oldest first). Stable. */
export function historicalChain(
  versions: SafetyDocumentVersion[],
): SafetyDocumentVersion[] {
  return [...versions].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
}

/** Pure: returns a copy of `prev` with `supersededOn` filled in from the
 *  next version's effective date. Caller is responsible for persisting. */
export function markSuperseded(
  prev: SafetyDocumentVersion,
  next: SafetyDocumentVersion,
): SafetyDocumentVersion {
  if (prev.documentId !== next.documentId) {
    throw new Error('markSuperseded: documentId mismatch');
  }
  if (next.effectiveOn <= prev.effectiveOn) {
    throw new Error('markSuperseded: next.effectiveOn must be after prev.effectiveOn');
  }
  return { ...prev, supersededOn: next.effectiveOn };
}

/** Returns upcoming versions — effective after `asOfDate` but no later
 *  than `asOfDate + withinDays`. Useful for "what's about to change" cards. */
export function pendingChanges(
  versions: SafetyDocumentVersion[],
  asOfDate: string,
  withinDays: number,
): SafetyDocumentVersion[] {
  if (withinDays < 0) throw new Error('withinDays must be non-negative');
  const cutoff = addDays(asOfDate, withinDays);
  return versions
    .filter((v) => v.effectiveOn > asOfDate && v.effectiveOn <= cutoff)
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
}

/** Stale-document audit. Returns null if fresh; otherwise the days the
 *  current version is over the freshness threshold. CA §3203 doesn't
 *  set a hard cadence but Cal/OSHA inspectors expect annual review of
 *  the IIPP at minimum; this is a soft warn helper. */
export function staleByDays(
  current: SafetyDocumentVersion | null,
  asOfDate: string,
  maxAgeDays: number,
): number | null {
  if (!current) return null;
  if (maxAgeDays < 0) throw new Error('maxAgeDays must be non-negative');
  const age = daysBetween(current.effectiveOn, asOfDate);
  return age > maxAgeDays ? age - maxAgeDays : null;
}

// ---- helpers ----

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}

function formatIso(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(iso: string, days: number): string {
  return formatIso(parseIso(iso) + days * 24 * 60 * 60 * 1000);
}

function daysBetween(a: string, b: string): number {
  return Math.floor((parseIso(b) - parseIso(a)) / (24 * 60 * 60 * 1000));
}
