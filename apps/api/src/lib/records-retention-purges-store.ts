// Postgres-backed store for records-retention purge batches.
//
// Each batch is the operator's confirmation that a specific set of
// records cleared their statutory retention window AND are not
// frozen by an active legal hold. The batch is the audit-grade proof.
//
// Phase 1 ships with bytesDeleted=false on every batch — the operator
// decision is recorded but the underlying rows stay. Byte deletion
// becomes a per-store opt-in later.

import { prisma } from '@yge/db';
import {
  RETENTION_RULES,
  RetentionPurgeBatchSchema,
  isPurgeEligible,
  newRetentionPurgeBatchId,
  type AuditEntityType,
  type LegalHold,
  type RecordRetentionRule,
  type RetentionPurgeBatch,
  type RetentionPurgeBatchCreate,
  type RetentionPurgeBatchRow,
  type RetentionPurgeConfirmResult,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';
import { getRequestCompanyId } from './request-context';
import { listLegalHolds } from './legal-holds-store';
import { collectRetentionCandidates, computePurgeDate } from './records-retention-job';

const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

function row2batch(row: { data: unknown }): RetentionPurgeBatch | null {
  const r = RetentionPurgeBatchSchema.safeParse(row.data);
  return r.success ? r.data : null;
}

export async function listRetentionPurgeBatches(): Promise<RetentionPurgeBatch[]> {
  const rows = await prisma.recordsRetentionPurge.findMany({
    where: { companyId: companyId() },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(row2batch).filter((b): b is RetentionPurgeBatch => b !== null);
}

function findRuleForEntityType(
  entityType: AuditEntityType,
  ruleAuthority?: string,
): RecordRetentionRule | undefined {
  if (entityType === 'Document') {
    return RETENTION_RULES.find(
      (r) => r.entityType === 'CompanyDocument' && (!ruleAuthority || r.authority === ruleAuthority),
    );
  }
  return RETENTION_RULES.find(
    (r) => r.entityType === entityType && (!ruleAuthority || r.authority === ruleAuthority),
  );
}

function holdsFreezing(
  holds: LegalHold[],
  entityType: string,
  entityId: string,
): string[] {
  const ids: string[] = [];
  for (const h of holds) {
    if (h.status !== 'ACTIVE') continue;
    for (const e of h.entities) {
      if (e.entityType === entityType && e.entityId === entityId) {
        ids.push(h.id);
      }
    }
  }
  return ids;
}

export async function confirmRetentionPurge(
  input: RetentionPurgeBatchCreate,
  ctx?: AuditContext,
  asOfIso: string = new Date().toISOString(),
): Promise<RetentionPurgeConfirmResult> {
  const rule = findRuleForEntityType(input.entityType, input.ruleAuthority);
  if (!rule) {
    return {
      batch: null,
      rejectedNotEligible: [],
      rejectedFrozen: [],
      rejectedUnknown: input.entityIds,
    };
  }

  const candidates = await collectRetentionCandidates(rule);
  const candidateById = new Map(candidates.map((c) => [c.entityId, c]));
  const holds = await listLegalHolds({ status: 'ACTIVE' });

  const acceptedRows: RetentionPurgeBatchRow[] = [];
  const rejectedNotEligible: string[] = [];
  const rejectedFrozen: string[] = [];
  const rejectedUnknown: string[] = [];

  for (const id of input.entityIds) {
    const c = candidateById.get(id);
    if (!c) {
      rejectedUnknown.push(id);
      continue;
    }
    if (!isPurgeEligible(rule, c.triggerDateIso, asOfIso)) {
      rejectedNotEligible.push(id);
      continue;
    }
    const frozenIds = holdsFreezing(holds, c.entityType, c.entityId);
    if (frozenIds.length > 0) {
      rejectedFrozen.push(id);
      continue;
    }
    acceptedRows.push({
      entityId: c.entityId,
      label: c.label,
      triggerDateIso: c.triggerDateIso,
      purgeEligibleOn: computePurgeDate(rule, c.triggerDateIso),
    });
  }

  if (acceptedRows.length === 0) {
    return { batch: null, rejectedNotEligible, rejectedFrozen, rejectedUnknown };
  }

  const batch: RetentionPurgeBatch = {
    id: newRetentionPurgeBatchId(),
    createdAt: asOfIso,
    companyId: ctx?.companyId ?? companyId(),
    entityType: input.entityType,
    ruleLabel: rule.label,
    ruleAuthority: rule.authority,
    ruleCitation: rule.citation,
    retainYears: rule.retainYears,
    asOfIso,
    operatorUserId: input.operatorUserId ?? ctx?.actorUserId ?? null,
    operatorReason: input.operatorReason,
    rows: acceptedRows,
    bytesDeleted: false,
  };

  await prisma.recordsRetentionPurge.create({
    data: {
      id: batch.id,
      companyId: batch.companyId,
      scheduledFor: batch.asOfIso,
      data: batch as unknown as object,
    },
  });

  await recordAudit({
    action: 'purge',
    entityType: input.entityType,
    entityId: batch.id,
    before: null,
    after: { batchId: batch.id, rowCount: acceptedRows.length },
    ctx: { ...(ctx ?? {}), reason: input.operatorReason },
  });
  for (const row of acceptedRows) {
    await recordAudit({
      action: 'purge',
      entityType: input.entityType,
      entityId: row.entityId,
      before: {
        label: row.label,
        triggerDateIso: row.triggerDateIso,
        purgeEligibleOn: row.purgeEligibleOn,
      },
      after: { batchId: batch.id, bytesDeleted: false },
      ctx: { ...(ctx ?? {}), reason: input.operatorReason },
    });
  }

  return { batch, rejectedNotEligible, rejectedFrozen, rejectedUnknown };
}
