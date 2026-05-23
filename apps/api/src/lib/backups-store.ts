// Backup snapshot store + builder.
//
// Walks the data root (DATA_DIR env, default ./data) and counts files
// + bytes per subdirectory. Also asks Prisma for row counts on the
// known managed tables. Writes a BackupManifest JSON under
// `backups/<id>.json` inside the data root.
//
// Doesn't yet write a tar of the actual bytes — that's a follow-up
// once the manifest pipeline is proven on the Render disk. The
// manifest already lets the office spot DRIFT (counts moved, hash
// shifted, store appeared / disappeared) before they cut a tar.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import {
  BackupManifestSchema,
  defaultBackupLabel,
  newBackupId,
  type BackupComponent,
  type BackupManifest,
} from '@yge/shared';

import { prisma } from '@yge/db';

function dataRoot(): string {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
}
function backupsRoot(): string {
  return path.join(dataRoot(), 'backups');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

/** Walk one file-store directory and produce a component summary. */
async function summarizeFileStore(
  storeName: string,
  storePath: string,
): Promise<BackupComponent> {
  const hash = createHash('sha256');
  let itemCount = 0;
  let totalBytes = 0;

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      itemCount += 1;
      try {
        const st = await fs.stat(full);
        totalBytes += st.size;
        const rel = path.relative(storePath, full);
        // Hash the relative path + file size + mtime — cheap proxy
        // for content drift. A real bytes-hash would require reading
        // each file; this is good enough for the manifest layer.
        hash.update(rel);
        hash.update('|');
        hash.update(String(st.size));
        hash.update('|');
        hash.update(String(Math.floor(st.mtimeMs)));
        hash.update('\n');
      } catch {
        // Skip unreadable files (race with delete, etc.).
      }
    }
  }
  await walk(storePath);

  return {
    kind: 'FILE_STORE',
    name: storeName,
    itemCount,
    totalBytes,
    manifestHash: itemCount > 0 ? hash.digest('hex') : undefined,
  };
}

/** Tables we count via Prisma. Approximate row sizes too via a quick
 *  count + sampled-byte estimate. */
const PRISMA_MODELS: Array<{
  name: string;
  count: () => Promise<number>;
}> = [
  { name: 'Company', count: () => prisma.company.count() },
  { name: 'User', count: () => prisma.user.count() },
  { name: 'Employee', count: () => prisma.employee.count() },
  { name: 'EmployeeCertification', count: () => prisma.employeeCertification.count() },
  { name: 'Customer', count: () => prisma.customer.count() },
  { name: 'Job', count: () => prisma.job.count() },
  { name: 'Estimate', count: () => prisma.estimate.count() },
  { name: 'BidItem', count: () => prisma.bidItem.count() },
  { name: 'CostLine', count: () => prisma.costLine.count() },
  { name: 'CostCode', count: () => prisma.costCode.count() },
];

// Optional models added later — count only if present on the client.
const OPTIONAL_PRISMA_MODELS: Array<{ name: string; key: string }> = [
  { name: 'Vendor', key: 'vendor' },
  { name: 'EquipmentInspection', key: 'equipmentInspection' },
  { name: 'PlanTakeoff', key: 'planTakeoff' },
  { name: 'Jsa', key: 'jsa' },
  { name: 'FixedAsset', key: 'fixedAsset' },
  { name: 'EquipmentServiceRecord', key: 'equipmentServiceRecord' },
];

async function summarizePrismaTables(): Promise<BackupComponent[]> {
  const out: BackupComponent[] = [];
  for (const m of PRISMA_MODELS) {
    try {
      const itemCount = await m.count();
      out.push({
        kind: 'PRISMA_TABLE',
        name: m.name,
        itemCount,
        // Bytes is unknown without scanning rows; leave a rough
        // approximation of 1 KB per row so the dashboard can show
        // relative size.
        totalBytes: itemCount * 1024,
      });
    } catch {
      // Table missing or DB unreachable — skip silently so a partial
      // backup still completes.
    }
  }
  // Optional models — use bracket access. Falls back silently if the
  // generated Prisma client doesn't include the key.
  const anyPrisma = prisma as unknown as Record<string, { count: () => Promise<number> }>;
  for (const opt of OPTIONAL_PRISMA_MODELS) {
    const model = anyPrisma[opt.key];
    if (!model || typeof model.count !== 'function') continue;
    try {
      const itemCount = await model.count();
      out.push({
        kind: 'PRISMA_TABLE',
        name: opt.name,
        itemCount,
        totalBytes: itemCount * 1024,
      });
    } catch {
      // Skip.
    }
  }
  return out;
}

interface SnapshotInput {
  label?: string;
  note?: string;
  triggeredBy: string;
}

/** Build a new snapshot manifest + persist it. Returns the manifest. */
export async function createBackupSnapshot(input: SnapshotInput): Promise<BackupManifest> {
  await ensureDir(backupsRoot());

  const root = dataRoot();
  const subdirs: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'backups') continue; // skip our own folder
      subdirs.push(e.name);
    }
    subdirs.sort();
  } catch {
    // root doesn't exist — no file-store components.
  }

  const fileStoreComponents: BackupComponent[] = [];
  for (const name of subdirs) {
    const full = path.join(root, name);
    if (!(await dirExists(full))) continue;
    fileStoreComponents.push(await summarizeFileStore(name, full));
  }
  const prismaComponents = await summarizePrismaTables();
  const components = [...fileStoreComponents, ...prismaComponents];

  const takenAt = new Date().toISOString();
  const id = newBackupId();
  const manifest = BackupManifestSchema.parse({
    id,
    takenAt,
    completedAt: new Date().toISOString(),
    label: input.label ?? defaultBackupLabel(),
    note: input.note,
    triggeredBy: input.triggeredBy,
    status: 'COMPLETE',
    components,
    totalBytes: components.reduce((s, c) => s + c.totalBytes, 0),
    totalItems: components.reduce((s, c) => s + c.itemCount, 0),
  });

  await fs.writeFile(
    path.join(backupsRoot(), `${id}.json`),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  return manifest;
}

export async function listBackups(): Promise<BackupManifest[]> {
  await ensureDir(backupsRoot());
  let names: string[];
  try {
    names = await fs.readdir(backupsRoot());
  } catch {
    return [];
  }
  const out: BackupManifest[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(backupsRoot(), name), 'utf8');
      const parsed = BackupManifestSchema.safeParse(JSON.parse(raw));
      if (parsed.success) out.push(parsed.data);
    } catch {
      // Skip unreadable manifests.
    }
  }
  out.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return out;
}

export async function getBackup(id: string): Promise<BackupManifest | null> {
  try {
    const raw = await fs.readFile(path.join(backupsRoot(), `${id}.json`), 'utf8');
    const parsed = BackupManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
