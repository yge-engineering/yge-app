// Postgres-backed store for ESIGN/UETA signatures.
//
// SignatureRecord is a Json-blob row keyed by id + companyId. The
// audit trail (recordAudit + Signature.auditContext) is what makes
// the proof bundle defensible.

import { prisma } from '@yge/db';
import {
  SignatureSchema,
  newSignatureId,
  type Signature,
  type SignatureCreate,
  type SignatureStatus,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2sig(row: { data: unknown }): Signature | null {
  const r = SignatureSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export interface SignatureListFilter {
  status?: SignatureStatus;
  documentType?: string;
  jobId?: string;
  signerEmail?: string;
}

export async function listSignatures(filter: SignatureListFilter = {}): Promise<Signature[]> {
  const rows = await prisma.signatureRecord.findMany({
    where: { companyId: companyId() },
    orderBy: { createdAt: 'desc' },
  });
  let all = rows.map(row2sig).filter((s): s is Signature => s !== null);
  if (filter.status) all = all.filter((s) => s.status === filter.status);
  if (filter.documentType) all = all.filter((s) => s.document.documentType === filter.documentType);
  if (filter.jobId) all = all.filter((s) => s.document.jobId === filter.jobId);
  if (filter.signerEmail) {
    const email = filter.signerEmail.toLowerCase();
    all = all.filter((s) => s.signer.email.toLowerCase() === email);
  }
  return all;
}

export async function getSignature(id: string): Promise<Signature | null> {
  if (!/^sig-[a-z0-9]{8}$/.test(id)) return null;
  const row = await prisma.signatureRecord.findFirst({
    where: { id, companyId: companyId() },
  });
  if (!row) return null;
  return row2sig(row);
}

async function persist(s: Signature): Promise<void> {
  await prisma.signatureRecord.upsert({
    where: { id: s.id },
    create: {
      id: s.id,
      companyId: companyId(),
      data: s as unknown as object,
    },
    update: { data: s as unknown as object },
  });
}

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
    return existing;
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
