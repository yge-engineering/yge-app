// File-based store for records-retention purge batches.
//
// Each batch is the operator's confirmation that a specific set of
// records cleared their statutory retention window AND are not
// frozen by an active legal hold. The batch is the audit-grade
// proof; the underlying records are then either:
//   - left in place (Phase 1 — operator decision recorded, byte
//     deletion deferred to a per-store delete pass), OR
//   - actually purged from the underlying store (later phase, when
//     each store grows a purgeRecord helper).
//
// Phase 1 ships with bytesDeleted = false on every batch. The
// batch + per-row audit entries are durable; the stores still
// contain the rows. This lets us iterate UI/UX with no risk of
// data loss while still building the audit trail.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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
import { listLegalHolds } from './legal-holds-store';
import { collectRetentionCandidates, computePurgeDate } from './records-retention-job';

function dataDir(): string {
  return (
    process.env.RETENTION_PURGES_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'retention-purges')
  );
}
function indexPath(): string { return path.join(dataDir(), 'index.json'); }
function rowPath(id: string): string { return path.join(dataDir(), `${id}.json`); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

async function readIndex(): Promise<RetentionPurgeBatch[]> {
  try {
    const raw = await fs.readFile(indexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        const r = RetentionPurgeBatchSchema.safeParse(entry);
        return r.success ? r.data : null;
      })
      .filter((b): b is RetentionPurgeBatch => b !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeIndex(rows: RetentionPurgeBatch[]) {
  await fs.writeFile(indexPath(), JSON.stringify(rows, null, 2), 'utf8');
}

async function persist(b: RetentionPurgeBatch) {
  await ensureDir();
  await fs.writeFile(rowPath(b.id), JSON.stringify(b, null, 2), 'utf8');
  const index = await readIndex();
  index.unshift(b);
  await writeIndex(index);
}

export async function listRetentionPurgeBatches(): Promise<RetentionPurgeBatch[]> {
  const rows = await readIndex();
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function findRuleForEntityType(
  entityType: AuditEntityType,
  ruleAuthority?: string,
): RecordRetentionRule | undefined {
  // Document buckets pivot through the synthetic 'CompanyDocument'
  // rules + the authority disambiguator (FEDERAL_I9 vs CA_DOI).
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

/**
 * Confirm a per-bucket purge. Re-evaluates eligibility + hold
 * state at apply-time so a stale dry-run report can't drive a
 * purge of records that have since been frozen or that aren't yet
 * past their retention window.
 *
 * Phase 1: writes the batch + audit entries; bytesDeleted=false.
 */
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
    companyId: ctx?.companyId ?? process.env.DEFAULT_COMPANY_ID ?? 'co-yge',
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
  await persist(batch);

  // One purge audit per row + a batch-level audit so the auditor
  // can see both granular per-record decisions and the bulk action.
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
