// Records-retention purge job — dry-run report.
//
// Walks every audited store, applies the appropriate rule from
// records-retention's RETENTION_RULES table to each row's trigger
// date, and intersects with active legal holds. Returns a
// per-entity report of rows purge-eligible (and not frozen).
//
// Phase 1 ships dry-run only — the actual delete pass requires
// operator review + confirmation per category. The dry-run is
// enough to tell YGE 'we have 14 AP invoices from 2018 that the
// IRS-7-year window has cleared; here's the list.'

import {
  RETENTION_RULES,
  documentRetentionMatch,
  isEntityFrozen,
  isPurgeEligible,
  type AuditEntityType,
  type Document,
  type LegalHold,
  type RecordRetentionRule,
} from '@yge/shared';
import { listLegalHolds } from './legal-holds-store';
import { listApInvoices } from './ap-invoices-store';
import { listApPayments } from './ap-payments-store';
import { listArInvoices } from './ar-invoices-store';
import { listArPayments } from './ar-payments-store';
import { listBankRecs } from './bank-recs-store';
import { listDocuments } from './documents-store';
import { listIncidents } from './incidents-store';
import { listSwpppInspections } from './swppp-inspections-store';
import { listTimeCards } from './time-cards-store';
import { listToolboxTalks } from './toolbox-talks-store';
import { listEmployees } from './employees-store';
import { listJobs } from './jobs-store';
import { listChangeOrders } from './change-orders-store';
import { listLienWaivers } from './lien-waivers-store';

// ---- Per-store record-shape extractor -----------------------------------

export interface RetentionCandidate {
  entityType: AuditEntityType;
  entityId: string;
  /** Plain-English display the report renders. */
  label: string;
  /** ISO timestamp / yyyy-mm-dd this rule's clock starts at. */
  triggerDateIso: string;
  /** Status / context note for the report ('voided' / 'archived' /
   *  etc.) so a reviewer can spot rows that should never be purged
   *  even when the timer has expired. */
  contextNote?: string;
}

export async function collectRetentionCandidates(rule: RecordRetentionRule): Promise<RetentionCandidate[]> {
  // Phase 1: only stores whose entityType the rule actually covers
  // contribute candidates. CompanyDocument rules (I-9, insurance
  // certs) need the documents store + per-row tag matching, which
  // ships in a follow-up bundle.
  switch (rule.entityType) {
    case 'ApInvoice': {
      const rows = await listApInvoices();
      return rows.map((r) => ({
        entityType: 'ApInvoice',
        entityId: r.id,
        label: `${r.vendorName} — ${r.invoiceNumber ?? '(no #)'} · $${(r.totalCents / 100).toLocaleString()}`,
        triggerDateIso: r.invoiceDate,
        contextNote: r.status,
      }));
    }
    case 'ApPayment': {
      const rows = await listApPayments();
      return rows.map((r) => ({
        entityType: 'ApPayment',
        entityId: r.id,
        label: `${r.method} · $${(r.amountCents / 100).toLocaleString()}`,
        triggerDateIso: r.paidOn,
        contextNote: r.voided ? 'voided' : undefined,
      }));
    }
    case 'ArInvoice': {
      const rows = await listArInvoices();
      return rows.map((r) => ({
        entityType: 'ArInvoice',
        entityId: r.id,
        label: `${r.invoiceNumber ?? '(no #)'} · $${(r.totalCents / 100).toLocaleString()}`,
        triggerDateIso: r.invoiceDate,
        contextNote: r.status,
      }));
    }
    case 'ArPayment': {
      const rows = await listArPayments();
      return rows.map((r) => ({
        entityType: 'ArPayment',
        entityId: r.id,
        label: `${r.method} · $${(r.amountCents / 100).toLocaleString()}`,
        triggerDateIso: r.receivedOn,
      }));
    }
    case 'BankRec': {
      const rows = await listBankRecs();
      return rows.map((r) => ({
        entityType: 'BankRec',
        entityId: r.id,
        label: `${r.bankAccountLabel} · ${r.statementDate}`,
        triggerDateIso: r.statementDate,
        contextNote: r.status,
      }));
    }
    case 'Incident': {
      const rows = await listIncidents();
      return rows.map((r) => ({
        entityType: 'Incident',
        entityId: r.id,
        label: r.description.slice(0, 80),
        triggerDateIso: r.incidentDate,
      }));
    }
    case 'SwpppInspection': {
      const rows = await listSwpppInspections();
      return rows.map((r) => ({
        entityType: 'SwpppInspection',
        entityId: r.id,
        label: `${r.jobId} · ${r.inspectedOn}`,
        triggerDateIso: r.inspectedOn,
      }));
    }
    case 'TimeCard': {
      const rows = await listTimeCards();
      return rows.map((r) => ({
        entityType: 'TimeCard',
        entityId: r.id,
        label: `${r.employeeId} · week of ${r.weekStarting}`,
        triggerDateIso: r.weekStarting,
        contextNote: r.status,
      }));
    }
    case 'ToolboxTalk': {
      const rows = await listToolboxTalks();
      return rows.map((r) => ({
        entityType: 'ToolboxTalk',
        entityId: r.id,
        label: `${r.topic ?? r.id} · ${r.heldOn}`,
        triggerDateIso: r.heldOn,
      }));
    }
    case 'Employee': {
      const rows = await listEmployees();
      // Trigger is EMPLOYEE_SEPARATION; only TERMINATED rows are
      // candidates. Schema has no terminationDate yet — use
      // updatedAt as a Phase-1 stand-in (the Employee terminate
      // workflow can backfill terminationDate later).
      return rows
        .filter((r) => r.status === 'TERMINATED')
        .map((r) => ({
          entityType: 'Employee',
          entityId: r.id,
          label: `${r.firstName} ${r.lastName} (${r.role})`,
          triggerDateIso: r.updatedAt,
          contextNote: 'TERMINATED',
        }));
    }
    case 'Job': {
      const rows = await listJobs();
      // Trigger is JOB_FINAL_ACCEPTANCE; ARCHIVED is the closest
      // terminal status today. updatedAt as the trigger is a
      // Phase-1 stand-in until JobFinalAcceptedDate lands.
      return rows
        .filter((r) => r.status === 'ARCHIVED' || r.status === 'LOST' || r.status === 'NO_BID')
        .map((r) => ({
          entityType: 'Job',
          entityId: r.id,
          label: `${r.projectName} (${r.status})`,
          triggerDateIso: r.updatedAt,
          contextNote: r.status,
        }));
    }
    case 'ChangeOrder': {
      const rows = await listChangeOrders();
      return rows.map((r) => ({
        entityType: 'ChangeOrder',
        entityId: r.id,
        label: `CO ${r.id}`,
        triggerDateIso: r.createdAt,
        contextNote: r.status,
      }));
    }
    case 'LienWaiver': {
      const rows = await listLienWaivers();
      return rows.map((r) => ({
        entityType: 'LienWaiver',
        entityId: r.id,
        label: `${r.kind} · ${r.throughDate}`,
        triggerDateIso: r.throughDate,
      }));
    }
    case 'CompanyDocument': {
      // Two CompanyDocument rules in the table:
      //   - I-9 (FEDERAL_I9, 3-yr post-EMPLOYEE_SEPARATION)
      //   - Insurance certs (CA_DOI, 7-yr post-POLICY_EXPIRATION)
      // The collector returns candidates only for the rule passed
      // in (rules iterate one at a time in buildRetentionPurgeReport).
      return collectCompanyDocumentCandidates(rule);
    }
    default:
      return [];
  }
}

async function collectCompanyDocumentCandidates(
  rule: RecordRetentionRule,
): Promise<RetentionCandidate[]> {
  const docs = await listDocuments();
  const out: RetentionCandidate[] = [];

  if (rule.authority === 'FEDERAL_I9') {
    // I-9 rule: only docs flagged i9, attached to a TERMINATED employee.
    // Trigger = employee.updatedAt (Phase-1 separation stand-in until
    // Employee.terminationDate field lands).
    const employees = await listEmployees();
    const empById = new Map(employees.map((e) => [e.id, e]));
    for (const doc of docs) {
      const match = documentRetentionMatch(doc);
      if (match?.ruleKey !== 'I9') continue;
      const empId = doc.linkedEmployeeId;
      if (!empId) continue;
      const emp = empById.get(empId);
      if (!emp || emp.status !== 'TERMINATED') continue;
      out.push({
        entityType: 'Document',
        entityId: doc.id,
        label: `I-9 · ${emp.firstName} ${emp.lastName} · ${doc.title}`.slice(0, 200),
        triggerDateIso: emp.updatedAt,
        contextNote: 'TERMINATED · separation stand-in',
      });
    }
    return out;
  }

  if (rule.authority === 'CA_DOI') {
    // Insurance / cert rule: kind in INSURANCE_LIKE_KINDS or tagged
    // accordingly, with policyExpirationDate set. Skips docs without
    // an expiration date (the trigger is undefined for them).
    for (const doc of docs) {
      const match = documentRetentionMatch(doc);
      if (match?.ruleKey !== 'INSURANCE') continue;
      const trigger = doc.policyExpirationDate;
      if (!trigger) continue;
      out.push({
        entityType: 'Document',
        entityId: doc.id,
        label: `${doc.title} · ${doc.kind}`.slice(0, 200),
        triggerDateIso: trigger,
        contextNote: extractDocContextNote(doc),
      });
    }
    return out;
  }

  return out;
}

function extractDocContextNote(doc: Document): string | undefined {
  if (doc.tags.includes('acord-25')) return 'acord-25';
  if (doc.tags.length > 0) return doc.tags.slice(0, 3).join(', ');
  return undefined;
}

// ---- Report shapes ------------------------------------------------------

export interface RetentionPurgeRow {
  entityType: AuditEntityType;
  entityId: string;
  label: string;
  triggerDateIso: string;
  purgeEligibleOn: string;
  /** True when an active legal hold freezes the entity. */
  frozen: boolean;
  frozenByHoldIds: string[];
  contextNote?: string;
}

export interface RetentionPurgeReport {
  generatedAt: string;
  /** Rules considered (all RETENTION_RULES whose entityType the
   *  collector knows how to enumerate today). */
  rulesEvaluated: number;
  /** Eligible-and-not-frozen rows ready for review. */
  eligibleCount: number;
  /** Eligible rows that an active hold blocks. */
  frozenCount: number;
  /** Per-entity breakdown. */
  perEntity: Array<{
    entityType: AuditEntityType;
    rule: { label: string; retainYears: number; authority: string };
    rows: RetentionPurgeRow[];
  }>;
}

/**
 * Compute the dry-run report. Pure read; no deletes.
 */
export async function buildRetentionPurgeReport(
  asOfIso: string = new Date().toISOString(),
): Promise<RetentionPurgeReport> {
  const holds = await listLegalHolds({ status: 'ACTIVE' });
  const perEntity: RetentionPurgeReport['perEntity'] = [];
  let rulesEvaluated = 0;
  let eligibleCount = 0;
  let frozenCount = 0;

  for (const rule of RETENTION_RULES) {
    rulesEvaluated += 1;
    const candidates = await collectRetentionCandidates(rule);
    const rows: RetentionPurgeRow[] = [];
    for (const c of candidates) {
      if (!isPurgeEligible(rule, c.triggerDateIso, asOfIso)) continue;
      const frozenHoldIds = holdsFreezing(holds, c.entityType, c.entityId, asOfIso);
      const frozen = frozenHoldIds.length > 0;
      const purgeEligibleOnDate = computePurgeDate(rule, c.triggerDateIso);
      rows.push({
        entityType: c.entityType,
        entityId: c.entityId,
        label: c.label,
        triggerDateIso: c.triggerDateIso,
        purgeEligibleOn: purgeEligibleOnDate,
        frozen,
        frozenByHoldIds: frozenHoldIds,
        contextNote: c.contextNote,
      });
      if (frozen) frozenCount += 1;
      else eligibleCount += 1;
    }
    if (rows.length > 0) {
      // CompanyDocument rules are stored under that synthetic key in
      // the rule table; the actual audit entityType for the rows is
      // 'Document'. Pin the bucket to the audit entity, not the
      // rule key.
      const bucketEntityType: AuditEntityType =
        rule.entityType === 'CompanyDocument' ? 'Document' : (rule.entityType as AuditEntityType);
      perEntity.push({
        entityType: bucketEntityType,
        rule: {
          label: rule.label,
          retainYears: rule.retainYears,
          authority: rule.authority,
        },
        rows,
      });
    }
  }

  return {
    generatedAt: asOfIso,
    rulesEvaluated,
    eligibleCount,
    frozenCount,
    perEntity,
  };
}

function holdsFreezing(
  holds: LegalHold[],
  entityType: string,
  entityId: string,
  asOfIso: string,
): string[] {
  const asOf = asOfIso.slice(0, 10);
  const ids: string[] = [];
  for (const h of holds) {
    for (const e of h.entities) {
      if (e.entityType === entityType && e.entityId === entityId) {
        if (isEntityFrozen([h], entityType, entityId, asOf)) {
          ids.push(h.id);
        }
      }
    }
  }
  return ids;
}

export function computePurgeDate(rule: RecordRetentionRule, triggerDateIso: string): string {
  const d = new Date(triggerDateIso + (triggerDateIso.includes('T') ? '' : 'T00:00:00Z'));
  if (!Number.isFinite(d.getTime())) return '';
  d.setUTCFullYear(d.getUTCFullYear() + rule.retainYears);
  return d.toISOString().slice(0, 10);
}
