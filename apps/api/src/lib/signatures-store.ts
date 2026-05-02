// File-based store for ESIGN/UETA signatures.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. Signatures
// are particularly important to log: the audit trail IS the
// 'attribution' element of the proof bundle, alongside the row's
// own auditContext.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  SignatureSchema,
  newSignatureId,
  type Signature,
  type SignatureCreate,
  type SignatureStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.SIGNATURES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'signatures')
  );
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<Signature[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const result = SignatureSchema.safeParse(entry);
        return result.success ? result.data : null;
      })
      .filter((s): s is Signature => s !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: Signature[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(s: Signature) {
  await ensureDir();
  await fs.writeFile(rowPath(s.id), JSON.stringify(s, null, 2), 'utf8');
  const index = await readIndex();
  const at = index.findIndex((row) => row.id === s.id);
  if (at >= 0) index[at] = s;
  else index.unshift(s);
  await writeIndex(index);
}

export interface SignatureListFilter {
  status?: SignatureStatus;
  documentType?: string;
  jobId?: string;
  signerEmail?: string;
}

export async function listSignatures(filter: SignatureListFilter = {}): Promise<Signature[]> {
  let rows = await readIndex();
  if (filter.status) rows = rows.filter((s) => s.status === filter.status);
  if (filter.documentType) rows = rows.filter((s) => s.document.documentType === filter.documentType);
  if (filter.jobId) rows = rows.filter((s) => s.document.jobId === filter.jobId);
  if (filter.signerEmail) {
    const email = filter.signerEmail.toLowerCase();
    rows = rows.filter((s) => s.signer.email.toLowerCase() === email);
  }
  return rows;
}

export async function getSignature(id: string): Promise<Signature | null> {
  if (!/^sig-[a-z0-9]{8}$/.test(id)) return null;
  try {
    const raw = await fs.readFile(rowPath(id), 'utf8');
    return SignatureSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Open a signing session. Creates the row in DRAFT with the signer +
 * document binding. Consent + the captured signature image come in
 * on submitSignature.
 */
export async function createSignature(
  input: SignatureCreate,
  ctx?: AuditContext,
): Promise<Signature> {
  const now = new Date().toISOString();
  const id = newSignatureId();
  const s: Signature = SignatureSchema.parse({
    id,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'DRAFT',
    ...input,
  });
  await persist(s);
  await recordAudit({
    action: 'create',
    entityType: 'Signature',
    entityId: id,
    after: s,
    ctx,
  });
  return s;
}

/**
 * Capture the affirmative signing event:
 *   - flips status to SIGNED
 *   - sets signedAt
 *   - merges in consent record (agreedAt + disclosureSha256 +
 *     affirmation text) + audit context (authenticatedAt + auth
 *     method + ip + ua)
 *   - optionally attaches the captured signature image (DRAWN method)
 *
 * Caller supplies the flattenedSha256 + flattenedReference once the
 * PDF has been embedded + archived (a separate finalize step).
 */
export interface SubmitSignatureInput {
  consent: Signature['consent'];
  authContext: Pick<Signature['auditContext'],
    | 'authMethod'
    | 'ipAddress'
    | 'userAgent'
    | 'deviceId'
    | 'latitude'
    | 'longitude'
    | 'sessionId'
    | 'authChallengeId'
    | 'authenticatedAt'
  >;
  signatureImage?: Signature['signatureImage'];
  signedAt?: string;
}

export async function submitSignature(
  id: string,
  input: SubmitSignatureInput,
  ctx?: AuditContext,
): Promise<Signature | null> {
  const existing = await getSignature(id);
  if (!existing) return null;
  if (existing.status !== 'DRAFT') {
    return existing; // idempotent — already signed/voided/etc
  }
  const now = new Date().toISOString();
  const updated: Signature = SignatureSchema.parse({
    ...existing,
    status: 'SIGNED',
    consent: input.consent,
    auditContext: { ...existing.auditContext, ...input.authContext },
    signatureImage: input.signatureImage ?? existing.signatureImage,
    signedAt: input.signedAt ?? now,
    updatedAt: now,
  });
  await persist(updated);
  await recordAudit({
    action: 'sign',
    entityType: 'Signature',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/**
 * Attach the flattened PDF hash + storage reference. Called after
 * the signing UI has captured the signature AND the server has
 * embedded + archived the certified PDF. Idempotent — a re-finalize
 * just overwrites the hash + reference.
 */
export async function finalizeSignature(
  id: string,
  flattenedSha256: string,
  flattenedReference: string | undefined,
  ctx?: AuditContext,
): Promise<Signature | null> {
  const existing = await getSignature(id);
  if (!existing) return null;
  if (existing.status !== 'SIGNED') return existing;
  const updated: Signature = SignatureSchema.parse({
    ...existing,
    flattenedSha256,
    flattenedReference,
    updatedAt: new Date().toISOString(),
  });
  await persist(updated);
  await recordAudit({
    action: 'update',
    entityType: 'Signature',
    entityId: id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}

/**
 * Void a signed (or draft) signature. Status flips VOIDED with the
 * voiding context recorded. The row stays — voids never delete.
 */
export async function voidSignature(
  id: string,
  voidedReason: string,
  voidedByUserId: string | undefined,
  ctx?: AuditContext,
): Promise<Signature | null> {
  const existing = await getSignature(id);
  if (!existing) return null;
  if (existing.status === 'VOIDED') return existing;
  const updated: Signature = SignatureSchema.parse({
    ...existing,
    status: 'VOIDED',
    voidedAt: new Date().toISOString(),
    voidedReason,
    voidedByUserId,
    updatedAt: new Date().toISOString(),
  });
  await persist(updated);
  await recordAudit({
    action: 'void',
    entityType: 'Signature',
    entityId: id,
    before: existing,
    after: updated,
    ctx: { ...ctx, reason: voidedReason },
  });
  return updated;
}
