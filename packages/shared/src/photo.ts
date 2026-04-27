// Photo log — per-job field photo metadata.
//
// Field photos are evidence on delay claims, change orders, SWPPP
// audits, OSHA incident reports, and disputed punch items. Phase 1
// stores metadata (date, location, caption, photographer) plus a
// `reference` string — typically a filename like "IMG_2026-04-25-01.jpg"
// or a path inside whatever drive Brook uses today. Phase 2 will
// handle direct image upload + EXIF extraction; the same record shape
// supports both.

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
}

export function computePhotoRollup(photos: Photo[]): PhotoRollup {
  const byCategoryMap = new Map<PhotoCategory, number>();
  let lastTakenOn: string | null = null;
  let missingGps = 0;
  for (const p of photos) {
    byCategoryMap.set(p.category, (byCategoryMap.get(p.category) ?? 0) + 1);
    if (!lastTakenOn || p.takenOn > lastTakenOn) lastTakenOn = p.takenOn;
    if (p.latitude == null || p.longitude == null) missingGps += 1;
  }
  return {
    total: photos.length,
    lastTakenOn,
    byCategory: Array.from(byCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    missingGps,
  };
}

export function newPhotoId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `ph-${hex.padStart(8, '0')}`;
}
