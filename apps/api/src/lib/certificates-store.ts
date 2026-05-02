// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'.
//
// File-based store for certificates.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CertificateSchema,
  newCertificateId,
  type Certificate,
  type CertificateCreate,
  type CertificatePatch,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.CERTIFICATES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'certificates')
  );
}
function indexPath(): string {
  return path.join(dataDir(), 'index.json');
}
function rowPath(id: string): string {
  return path.join(dataDir(), `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readIndex(): Promise<Certificate[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = CertificateSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((c): c is Certificate => c !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(entries: Certificate[]) {
  await fs.writeFile(indexPath(), JSON.stringify(entries, null, 2), 'utf8');
}

export async function createCertificate(
  input: CertificateCreate,
  ctx?: AuditContext,
): Promise<Certificate> {
  await ensureDir();
  const now = new Date().toISOString();
  const id = newCertificateId();
  const c: Certificate = {
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'ACTIVE',
    ...input,
  };
  CertificateSchema.parse(c);
  await fs.writeFile(rowPath(id), JSON.stringify(c, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(c);
  await writeIndex(index);
  await recordAudit({
    action: 'create',
    entityType: 'Certificate',
    entityId: id,
    after: c,
    ctx,
  });
  return c;
}

export async function listCertificates(): Promise<Certificate[]> {
  const all = await readIndex();
  // Sort by expiry-soonest first within active, then everything else.
  all.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1;
    }
    const ax = a.expiresOn ?? '9999-99-99';
    const bx = b.expiresOn ?? '9999-99-99';
    return ax.localeCompare(bx);
  });
  return all;
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (!/^cert-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return CertificateSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateCertificate(
  id: string,
  patch: CertificatePatch,
  ctx?: AuditContext,
  auditAction: 'update' | 'archive' = 'update',
): Promise<Certificate | null> {
  const existing = await getCertificate(id);
  if (!existing) return null;
  const updated: Certificate = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  CertificateSchema.parse(updated);
  await fs.writeFile(rowPath(id), JSON.stringify(updated, null, 2), 'utf8');
  const index = await readIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  } else {
    index.unshift(updated);
  }
  await writeIndex(index);
  await recordAudit({
    action: auditAction,
    entityType: 'Certificate',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
