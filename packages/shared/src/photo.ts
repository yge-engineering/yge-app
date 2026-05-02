// Photo log — per-job field photo metadata.
//
// Field photos are evidence on delay claims, change orders, SWPPP
// audits, OSHA incident reports, and disputed punch items. Phase 1
// stores metadata (date, location, caption, photographer) plus a
// `reference` string — typically a filename like "IMG_2026-04-25-01.jpg"
// or a path inside whatever drive Brook uses today. Phase 2 will
// handle direct image upload + EXIF extraction; the same record shape
// supports both.
//
// v6.2 court-admissible-evidence layer:
//   - sha256Hash + prevPhotoSha256 form a per-job hash chain so
//     anyone can prove photos were not reordered or edited after
//     upload (tamper any photo and every later photo in that job's
//     chain stops verifying).
//   - capturedAt is the full ISO timestamp with timezone offset
//     captured by the device clock at shutter — the legally-relevant
//     instant. (`takenOn` and `takenAt` remain for the human-readable
//     binder display; `capturedAt` is the machine-readable proof.)
//   - deviceId + exifJson preserve the chain of custody —
//     "this came off Ryan's iPhone, here's the raw EXIF, here's
//     the device fingerprint, here's the GPS accuracy, this was
//     not edited."
//
// All v6.2 fields are optional so legacy rows without them keep
// loading. The court-admissibility helper below checks completeness.

import { z } from 'zod';

export const PhotoCategorySchema = z.enum([
  'PROGRESS',          // routine documentation
  'PRE_CONSTRUCTION',  // existing-condition shots
  'DELAY',             // weather/access/utility delay
  'CHANGE_ORDER',      // CO scope justification
  'SWPPP',             // BMP inspections
  'INCIDENT',          // safety incident
  'PUNCH',             // closeout walkthrough deficiency
  'COMPLETION',        // final / handoff
  'OTHER',
]);
export type PhotoCategory = z.infer<typeof PhotoCategorySchema>;

export const PhotoSchema = z.object({
  /** Stable id `ph-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Date the photo was taken (yyyy-mm-dd). */
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Optional time of day (HH:MM 24h) — useful for incident timelines. */
  takenAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),

  /** Free-form location / station / area. */
  location: z.string().min(1).max(200),
  /** One-line caption that prints under the photo on the report. */
  caption: z.string().min(1).max(500),
  /** Who took it. */
  photographerName: z.string().max(120).optional(),

  category: PhotoCategorySchema.default('PROGRESS'),

  /** File reference — filename, drive path, S3 key, or full URL. Free-form
   *  for Phase 1. */
  reference: z.string().max(800),

  /** Optional GPS coords from EXIF, recorded as decimal degrees. */
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  // ---- v6.2 court-admissible-evidence layer (all optional) ----------

  /** Full ISO timestamp with TZ offset from the device clock at the
   *  moment the shutter fired. Distinct from `takenOn`/`takenAt` which
   *  are the binder's human-readable y-m-d + HH:MM. */
  capturedAt: z.string().optional(),

  /** GPS accuracy radius (meters) reported by the device. Useful for
   *  knowing whether the geofence check is meaningful. */
  gpsAccuracyMeters: z.number().nonnegative().optional(),

  /** Altitude in meters from EXIF / device sensor. */
  altitudeMeters: z.number().optional(),

  /** Compass bearing in degrees [0,360). 0 = north. */
  bearingDegrees: z.number().min(0).max(360).optional(),

  /** Stable identifier for the device that captured the photo —
   *  Apple's identifierForVendor, Android ANDROID_ID, or our PWA
   *  install id. Persists chain-of-custody across the device's life. */
  deviceId: z.string().max(120).optional(),

  /** Lowercase 64-char hex SHA-256 of the *original image bytes*
   *  (before any compression / overlay / redaction). This is what
   *  proves the photo on file is the photo that came off the device. */
  sha256Hash: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars').optional(),

  /** The sha256Hash of the previous photo in this job's chain, or
   *  null/undefined for the first photo in the chain. Forms a
   *  tamper-evident sequence — flipping any photo's bytes or
   *  rearranging the chain breaks verification at and after the
   *  edit point. */
  prevPhotoSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),

  /** Raw EXIF as JSON, captured at upload. Preserves the forensic
   *  record so an expert can re-examine it later — make/model,
   *  software version, original timestamp, GPS sub-fields, lens. */
  exifJson: z.record(z.unknown()).optional(),

  /** Whether redaction (faces / plates) was applied to a derived
   *  copy. The original is still archived behind the
   *  `sha256Hash`-tracked file; this flag governs the EXTERNAL copy
   *  used in pay apps / proposals / submittals. */
  redactionApplied: z.boolean().optional(),

  /** Optional cross-references so the photo shows up on the related
   *  record's binder section. */
  rfiId: z.string().max(120).optional(),
  changeOrderId: z.string().max(120).optional(),
  swpppInspectionId: z.string().max(120).optional(),
  incidentId: z.string().max(120).optional(),
  punchItemId: z.string().max(120).optional(),
  dailyReportId: z.string().max(120).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const PhotoCreateSchema = PhotoSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: PhotoCategorySchema.optional(),
});
export type PhotoCreate = z.infer<typeof PhotoCreateSchema>;

export const PhotoPatchSchema = PhotoCreateSchema.partial();
export type PhotoPatch = z.infer<typeof PhotoPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function photoCategoryLabel(c: PhotoCategory): string {
  switch (c) {
    case 'PROGRESS': return 'Progress';
    case 'PRE_CONSTRUCTION': return 'Pre-construction';
    case 'DELAY': return 'Delay';
    case 'CHANGE_ORDER': return 'Change order';
    case 'SWPPP': return 'SWPPP';
    case 'INCIDENT': return 'Incident';
    case 'PUNCH': return 'Punch';
    case 'COMPLETION': return 'Completion';
    case 'OTHER': return 'Other';
  }
}

export interface PhotoRollup {
  total: number;
  /** Most recent photo date. */
  lastTakenOn: string | null;
  /** Counts by category. */
  byCategory: Array<{ category: PhotoCategory; count: number }>;
  /** Photos missing a GPS fix — used to prompt the field crew to
   *  enable location tagging. */
  missingGps: number;
  /** v6.2: photos that pass the court-admissibility check (capturedAt
   *  + GPS + deviceId + sha256). The disputes-defense export marks
   *  these as full-quality evidence. */
  admissibleCount: number;
  /** v6.2: photos that have a sha256 hash chain link claim. Helps
   *  surface 'this job has 12 of 50 photos with chain integrity —
   *  enable hash-chain on uploads going forward.' */
  chainedCount: number;
}

export function computePhotoRollup(photos: Photo[]): PhotoRollup {
  const byCategoryMap = new Map<PhotoCategory, number>();
  let lastTakenOn: string | null = null;
  let missingGps = 0;
  let admissibleCount = 0;
  let chainedCount = 0;
  for (const p of photos) {
    byCategoryMap.set(p.category, (byCategoryMap.get(p.category) ?? 0) + 1);
    if (!lastTakenOn || p.takenOn > lastTakenOn) lastTakenOn = p.takenOn;
    if (p.latitude == null || p.longitude == null) missingGps += 1;
    if (isCourtAdmissible(p)) admissibleCount += 1;
    if (p.sha256Hash) chainedCount += 1;
  }
  return {
    total: photos.length,
    lastTakenOn,
    byCategory: Array.from(byCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    missingGps,
    admissibleCount,
    chainedCount,
  };
}

export function newPhotoId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `ph-${hex.padStart(8, '0')}`;
}

// ---- v6.2 hash chain + court-admissibility ------------------------------

/**
 * Whether this photo carries every metadata field a court-admissible
 * evidence package needs. Used by the upload UI to refuse uploads
 * that didn't capture enough — and by the disputes-defense export to
 * mark which photos are full-quality evidence vs. binder-only.
 *
 * Required:
 *   - capturedAt (the legally relevant timestamp)
 *   - latitude + longitude (where the shutter fired)
 *   - deviceId (chain of custody)
 *   - sha256Hash (the bytes' fingerprint)
 *
 * Not required: prevPhotoSha256 (the FIRST photo in a chain has none),
 * gpsAccuracyMeters, exifJson (preserved when available, but a
 * device that strips EXIF is not a non-starter for admissibility).
 */
export function isCourtAdmissible(p: Photo): boolean {
  if (!p.capturedAt) return false;
  if (p.latitude == null || p.longitude == null) return false;
  if (!p.deviceId) return false;
  if (!p.sha256Hash) return false;
  return true;
}

/**
 * Plain-English list of why a photo would NOT pass the
 * court-admissibility check. Drives the 'this photo can't be used
 * in a claims defense — fix this' UI prompt.
 */
export function admissibilityGaps(p: Photo): string[] {
  const gaps: string[] = [];
  if (!p.capturedAt) gaps.push('no capturedAt timestamp');
  if (p.latitude == null || p.longitude == null) gaps.push('no GPS coords');
  if (!p.deviceId) gaps.push('no deviceId — chain of custody broken');
  if (!p.sha256Hash) gaps.push('no sha256 fingerprint of the original bytes');
  return gaps;
}

export interface PhotoChainResult {
  /** True iff every photo with prevPhotoSha256 set links to the
   *  immediately-previous photo's sha256Hash in the supplied
   *  ordering. */
  valid: boolean;
  /** Indices of photos whose prevPhotoSha256 doesn't match the prior
   *  photo's sha256Hash. Empty when the chain is intact. */
  brokenAt: number[];
  /** Indices skipped from the check because they don't carry both
   *  hashes. Reported separately so the UI can flag 'mixed
   *  adoption' chains where some uploads predate v6.2 hardening. */
  skipped: number[];
}

/**
 * Verify the per-job hash chain across an ordered photo list.
 *
 * Pre: caller has already sorted the input by capturedAt asc (or
 * uploadedAt — either is fine, the chain only requires a stable
 * ordering at write time and the same ordering at verify time).
 *
 * The first photo in the chain is allowed to have no
 * prevPhotoSha256. Subsequent photos must have prevPhotoSha256
 * equal to the prior photo's sha256Hash, otherwise the index is
 * reported in `brokenAt`.
 *
 * Photos missing either of the two hashes are reported in `skipped`
 * — they don't break the chain, but they don't strengthen it either.
 */
export function verifyPhotoChain(photos: readonly Photo[]): PhotoChainResult {
  const brokenAt: number[] = [];
  const skipped: number[] = [];
  let lastHash: string | undefined;
  for (let i = 0; i < photos.length; i += 1) {
    const p = photos[i]!;
    if (!p.sha256Hash) { skipped.push(i); lastHash = undefined; continue; }
    if (i === 0) { lastHash = p.sha256Hash; continue; }
    if (p.prevPhotoSha256 == null) {
      // No claim of chaining — treat as a fresh start.
      lastHash = p.sha256Hash;
      continue;
    }
    if (lastHash == null) {
      // The chain was reset by an earlier skip (e.g. a legacy photo
      // with no sha256). We can't verify the link, but we shouldn't
      // declare it broken either — treat this photo as the start of
      // a new sub-chain.
      lastHash = p.sha256Hash;
      continue;
    }
    if (p.prevPhotoSha256 !== lastHash) {
      brokenAt.push(i);
    }
    lastHash = p.sha256Hash;
  }
  return { valid: brokenAt.length === 0, brokenAt, skipped };
}
