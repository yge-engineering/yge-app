// Vendor-anchored per-job punch list detail snapshot.
//
// Plain English: for one vendor (matched by responsibleVendorId,
// falling back to canonicalized responsibleParty name), return one
// row per job they're on the hook for punch items: total, open,
// closed, safety/major/minor breakouts, overdue count, last
// identified date. Sorted by open desc.
//
// Pure derivation. No persisted records.

import type { PunchItem } from './punch-list';

export interface VendorPunchDetailRow {
  jobId: string;
  total: number;
  open: number;
  closed: number;
  safety: number;
  major: number;
  minor: number;
  overdue: number;
  lastIdentifiedDate: string | null;
}

export interface VendorPunchDetailSnapshotResult {
  asOf: string;
  vendorName: string;
  rows: VendorPunchDetailRow[];
}

export interface VendorPunchDetailSnapshotInputs {
  /** The free-form vendor name to match against responsibleParty. */
  vendorName: string;
  /** Optional vendor id to match against responsibleVendorId. */
  vendorId?: string;
  punchItems: PunchItem[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function canonVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,&'()]/g, ' ')
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPEN_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'DISPUTED']);

export function buildVendorPunchDetailSnapshot(
  inputs: VendorPunchDetailSnapshotInputs,
): VendorPunchDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = canonVendor(inputs.vendorName);
  const targetId = inputs.vendorId ?? '';

  type Acc = {
    total: number;
    open: number;
    closed: number;
    safety: number;
    major: number;
    minor: number;
    overdue: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { total: 0, open: 0, closed: 0, safety: 0, major: 0, minor: 0, overdue: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.punchItems) {
    const idMatch = targetId.length > 0 && p.responsibleVendorId === targetId;
    const nameMatch = canonVendor(p.responsibleParty ?? '') === targetName;
    if (!idMatch && !nameMatch) continue;
    if (p.identifiedOn > asOf) continue;
    const a = getAcc(p.jobId);
    a.total += 1;
    if (p.status === 'CLOSED' || p.status === 'WAIVED') a.closed += 1;
    if (OPEN_STATUSES.has(p.status)) a.open += 1;
    if (p.severity === 'SAFETY') a.safety += 1;
    else if (p.severity === 'MAJOR') a.major += 1;
    else if (p.severity === 'MINOR') a.minor += 1;
    if (OPEN_STATUSES.has(p.status) && p.dueOn && p.dueOn < asOf) a.overdue += 1;
    if (a.lastDate == null || p.identifiedOn > a.lastDate) a.lastDate = p.identifiedOn;
  }

  const rows: VendorPunchDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      open: a.open,
      closed: a.closed,
      safety: a.safety,
      major: a.major,
      minor: a.minor,
      overdue: a.overdue,
      lastIdentifiedDate: a.lastDate,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    vendorName: inputs.vendorName,
    rows,
  };
}
