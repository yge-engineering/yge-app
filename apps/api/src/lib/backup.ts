// Backup helper — snapshot the API's persistent disk to a tar.gz
// and (when configured) push it to S3-compatible storage.
//
// Plain English: every night the scheduler walks `data/`, packs it
// into a single archive in `data/backups/<yyyy-mm-dd>.tar.gz`, and
// uploads to BACKUP_S3_BUCKET if the env is set. Old local archives
// past BACKUP_RETAIN_DAYS get pruned. If S3 isn't configured we
// still keep the local snapshots — recovery from disk loss requires
// off-host backup, but for "I deleted the wrong row" the local
// archive is enough.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from './logger';

const execAsync = promisify(exec);

interface BackupSummary {
  startedAt: string;
  finishedAt: string;
  archivePath: string;
  archiveBytes: number;
  uploadedToS3: boolean;
  durationMs: number;
}

function dataRoot(): string {
  return process.env.DATA_ROOT ?? path.resolve(process.cwd(), 'data');
}
function backupsDir(): string {
  return process.env.BACKUPS_DIR ?? path.join(dataRoot(), 'backups');
}

function isoDateTimeFile(): string {
  // 2026-05-05T13-15-22Z — filesystem-safe ISO.
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
}

let lastSummary: BackupSummary | null = null;
let timer: NodeJS.Timeout | null = null;

async function pruneOldArchives(): Promise<void> {
  const retainDays = Math.max(
    1,
    Number.parseInt(process.env.BACKUP_RETAIN_DAYS ?? '14', 10),
  );
  const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1_000;
  try {
    const entries = await fs.readdir(backupsDir());
    for (const name of entries) {
      if (!name.endsWith('.tar.gz')) continue;
      const p = path.join(backupsDir(), name);
      try {
        const stat = await fs.stat(p);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(p);
        }
      } catch {
        // skip — best-effort prune
      }
    }
  } catch {
    // backups dir may not exist yet on first run
  }
}

export async function runBackupOnce(): Promise<BackupSummary> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  await fs.mkdir(backupsDir(), { recursive: true });
  const archiveName = `yge-data-${isoDateTimeFile()}.tar.gz`;
  const archivePath = path.join(backupsDir(), archiveName);

  // tar from inside the data root so paths are relative + portable.
  // Exclude the backups dir itself to avoid recursive growth.
  const cmd =
    `tar -czf ${JSON.stringify(archivePath)} ` +
    `--exclude=backups ` +
    `-C ${JSON.stringify(dataRoot())} .`;
  await execAsync(cmd);
  const stat = await fs.stat(archivePath);

  let uploaded = false;
  if (process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_BUCKET.trim()) {
    try {
      // Use the s3 CLI when present; not all images have it. We attempt
      // the call and silently fall through if it errors so the local
      // snapshot is still useful.
      const bucket = process.env.BACKUP_S3_BUCKET.trim();
      const prefix = (process.env.BACKUP_S3_PREFIX ?? 'yge-api').replace(
        /^\/+|\/+$/g,
        '',
      );
      const dest = `s3://${bucket}/${prefix}/${archiveName}`;
      await execAsync(
        `aws s3 cp ${JSON.stringify(archivePath)} ${JSON.stringify(dest)}`,
      );
      uploaded = true;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'Backup S3 upload failed; local snapshot retained.',
      );
    }
  }

  await pruneOldArchives();

  const summary: BackupSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    archivePath,
    archiveBytes: stat.size,
    uploadedToS3: uploaded,
    durationMs: Date.now() - t0,
  };
  lastSummary = summary;
  logger.info(
    {
      archivePath,
      mb: Math.round(stat.size / 1024 / 1024),
      uploaded,
      durationMs: summary.durationMs,
    },
    'Backup complete',
  );
  return summary;
}

export function getLastBackupSummary(): BackupSummary | null {
  return lastSummary;
}

/** Daily backup at ~3 AM local time. Configurable via
 *  BACKUP_INTERVAL_MS (default 24h). Set to 0 to disable. */
export function startBackupScheduler(): void {
  const intervalMs = Number.parseInt(
    process.env.BACKUP_INTERVAL_MS ?? `${24 * 60 * 60 * 1_000}`,
    10,
  );
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    logger.info('Backup scheduler disabled (BACKUP_INTERVAL_MS=0).');
    return;
  }
  // Initial run after a 5-min boot grace.
  setTimeout(() => {
    void runBackupOnce().catch((err) =>
      logger.error({ err }, 'Initial backup failed'),
    );
  }, 5 * 60_000);
  timer = setInterval(() => {
    void runBackupOnce().catch((err) =>
      logger.error({ err }, 'Scheduled backup failed'),
    );
  }, intervalMs);
  logger.info({ intervalMs }, 'Backup scheduler started.');
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
