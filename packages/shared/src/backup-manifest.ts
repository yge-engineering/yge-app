// Backup manifest — point-in-time snapshot record.
//
// The YGE app persists most operational data in JSON files under
// /var/data/<store>/ on Render's persistent disk (see render.yaml's
// many *_DATA_DIR env vars). A few entities (master profile, vendors,
// plan-takeoffs, equipment-inspections, fixed-assets, jsas) live in
// Postgres. Either disk is exactly one human mistake or one Render
// restart-with-disk-wipe away from data loss.
//
// This module is the manifest layer. Each backup is a list of
// components (one per data dir + one per Prisma table) with:
//   - file count
//   - total bytes
//   - a SHA-256 over the per-file checksums (manifestHash) so two
//     manifests can be compared cheaply for drift
//
// The API stores backups under BACKUPS_DATA_DIR (a sibling of the
// other data dirs). A scheduled job (or a manual "Snapshot now"
// click) writes a fresh tar + a fresh manifest, dated yyyy-mm-dd-HHMM.
//
// Pure: this module just defines the shapes + helpers. The bytes-on-
// disk work lives in the API.

import { z } from 'zod';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const HEX_64 = /^[0-9a-f]{64}$/;

export const BackupComponentKindSchema = z.enum(['FILE_STORE', 'PRISMA_TABLE']);
export type BackupComponentKind = z.infer<typeof BackupComponentKindSchema>;

export const BackupComponentSchema = z.object({
  kind: BackupComponentKindSchema,
  /** For FILE_STORE: the data dir name (e.g. 'vendors').
   *  For PRISMA_TABLE: the table name. */
  name: z.string().min(1).max(120),
  /** File count for FILE_STORE; row count for PRISMA_TABLE. */
  itemCount: z.number().int().nonnegative(),
  /** Approximate uncompressed bytes. 0 when empty. */
  totalBytes: z.number().int().nonnegative(),
  /** SHA-256 over the concatenated per-file checksums (FILE_STORE) or
   *  per-row id+updatedAt pairs (PRISMA_TABLE). Lets two manifests
   *  compare cheaply without re-reading every file. */
  manifestHash: z.string().regex(HEX_64).optional(),
});
export type BackupComponent = z.infer<typeof BackupComponentSchema>;

export const BackupStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETE',
  'FAILED',
]);
export type BackupStatus = z.infer<typeof BackupStatusSchema>;

export const BackupManifestSchema = z.object({
  id: z.string().min(1).max(80),
  /** ISO-8601 UTC timestamp the snapshot started. */
  takenAt: z.string().regex(ISO_DATE_TIME, 'Use ISO-8601 UTC'),
  /** ISO-8601 UTC timestamp the snapshot finished (or '' while pending). */
  completedAt: z.string().optional(),
  /** Auto-generated label, e.g. '2026-05-23-1015' or 'pre-migration-2026-05-23'. */
  label: z.string().min(1).max(200),
  /** Free-form note — 'before raising bid #14', 'monthly auto-snapshot', etc. */
  note: z.string().max(2000).optional(),
  /** Either 'auto' (scheduled) or the actor that triggered the snapshot. */
  triggeredBy: z.string().min(1).max(120),
  status: BackupStatusSchema,
  components: z.array(BackupComponentSchema).default([]),
  /** Sum of component bytes. */
  totalBytes: z.number().int().nonnegative().default(0),
  /** Sum of component item counts. */
  totalItems: z.number().int().nonnegative().default(0),
  /** Optional URL / disk path to the actual tar.gz, when stored. */
  archivePath: z.string().max(800).optional(),
  /** SHA-256 of the archive (lowercase hex). */
  archiveSha256: z.string().regex(HEX_64).optional(),
  /** When something failed. */
  errorMessage: z.string().max(2000).optional(),
});
export type BackupManifest = z.infer<typeof BackupManifestSchema>;

export const BackupManifestCreateSchema = BackupManifestSchema.omit({
  id: true,
  takenAt: true,
}).extend({
  takenAt: z.string().regex(ISO_DATE_TIME).optional(),
});
export type BackupManifestCreate = z.infer<typeof BackupManifestCreateSchema>;

/** Build a label from a Date — `2026-05-23-1015` UTC. */
export function defaultBackupLabel(when: Date = new Date()): string {
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  const hh = String(when.getUTCHours()).padStart(2, '0');
  const mm = String(when.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${hh}${mm}`;
}

/** Roll up a list of manifests into a single overview. */
export interface BackupOverview {
  total: number;
  latestCompleted: BackupManifest | null;
  latestFailed: BackupManifest | null;
  latestPending: BackupManifest | null;
  totalBytes: number;
  oldestCompleted: BackupManifest | null;
  ageOfLatestHours: number | null;
}

export function summarizeBackups(manifests: BackupManifest[]): BackupOverview {
  const completed = manifests
    .filter((b) => b.status === 'COMPLETE')
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const failed = manifests
    .filter((b) => b.status === 'FAILED')
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const pending = manifests
    .filter((b) => b.status === 'PENDING' || b.status === 'IN_PROGRESS')
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const totalBytes = manifests.reduce((s, b) => s + b.totalBytes, 0);
  const latestCompleted = completed[0] ?? null;
  const oldestCompleted = completed[completed.length - 1] ?? null;
  const ageOfLatestHours = latestCompleted
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(latestCompleted.takenAt)) / (1000 * 60 * 60)),
      )
    : null;
  return {
    total: manifests.length,
    latestCompleted,
    latestFailed: failed[0] ?? null,
    latestPending: pending[0] ?? null,
    totalBytes,
    oldestCompleted,
    ageOfLatestHours,
  };
}

/** Drift status comparing two manifests (usually 'latest vs. previous'). */
export interface BackupDriftRow {
  name: string;
  kind: BackupComponentKind;
  itemDelta: number;
  bytesDelta: number;
  hashChanged: boolean;
  status: 'IDENTICAL' | 'CHANGED' | 'ADDED' | 'REMOVED';
}

export function compareManifests(
  prior: BackupManifest | null,
  current: BackupManifest,
): BackupDriftRow[] {
  const priorByName = new Map<string, BackupComponent>();
  if (prior) for (const c of prior.components) priorByName.set(c.name, c);
  const out: BackupDriftRow[] = [];
  for (const c of current.components) {
    const p = priorByName.get(c.name);
    if (!p) {
      out.push({
        name: c.name,
        kind: c.kind,
        itemDelta: c.itemCount,
        bytesDelta: c.totalBytes,
        hashChanged: false,
        status: 'ADDED',
      });
      continue;
    }
    priorByName.delete(c.name);
    const hashChanged =
      Boolean(c.manifestHash) &&
      Boolean(p.manifestHash) &&
      c.manifestHash !== p.manifestHash;
    const itemDelta = c.itemCount - p.itemCount;
    const bytesDelta = c.totalBytes - p.totalBytes;
    const status =
      hashChanged || itemDelta !== 0 || bytesDelta !== 0 ? 'CHANGED' : 'IDENTICAL';
    out.push({
      name: c.name,
      kind: c.kind,
      itemDelta,
      bytesDelta,
      hashChanged,
      status,
    });
  }
  for (const p of priorByName.values()) {
    out.push({
      name: p.name,
      kind: p.kind,
      itemDelta: -p.itemCount,
      bytesDelta: -p.totalBytes,
      hashChanged: false,
      status: 'REMOVED',
    });
  }
  // Sort: REMOVED + CHANGED first (require attention), then ADDED,
  // then IDENTICAL.
  const rank: Record<BackupDriftRow['status'], number> = {
    REMOVED: 0,
    CHANGED: 1,
    ADDED: 2,
    IDENTICAL: 3,
  };
  out.sort((a, b) => {
    const s = rank[a.status] - rank[b.status];
    if (s !== 0) return s;
    return a.name.localeCompare(b.name);
  });
  return out;
}

/** Returns true when no completed backup exists in the last `maxAgeHours`. */
export function isBackupStale(overview: BackupOverview, maxAgeHours: number): boolean {
  if (overview.ageOfLatestHours === null) return true;
  return overview.ageOfLatestHours > maxAgeHours;
}

/** Pretty-print bytes as KB/MB/GB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function newBackupId(): string {
  const r = Math.random().toString(16).slice(2, 10).padStart(8, '0');
  return `bkp-${r}`;
}
