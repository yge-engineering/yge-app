// Power-tool checkout tracker.
//
// Plain English: for the shop manager, who has each tool right now,
// and how long has it been out? Tools that have been ASSIGNED for
// 60+ days probably need a chase-up — either the borrower forgot,
// the tool walked off, or a status update was missed.
//
// Pure derivation. No persisted records.

import type { Tool } from './tool';

export type ToolAssignmentTier =
  | 'IN_YARD_OK'   // not assigned; in yard / shop
  | 'CHECKED_OUT'  // assigned <30 days
  | 'AGED_30'      // assigned 30-59 days
  | 'AGED_60'      // assigned 60+ days — chase
  | 'LOST_OR_REPAIR'; // LOST or OUT_FOR_REPAIR

export interface ToolCheckoutRow {
  toolId: string;
  name: string;
  category: Tool['category'];
  status: Tool['status'];
  assignedToEmployeeId?: string;
  assignedAt?: string;
  daysAssigned: number | null;
  tier: ToolAssignmentTier;
}

export interface ToolCheckoutRollup {
  total: number;
  inYard: number;
  checkedOut: number;
  aged30: number;
  aged60: number;
  lostOrRepair: number;
}

export interface ToolCheckoutInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  tools: Tool[];
}

export function buildToolCheckout(inputs: ToolCheckoutInputs): {
  rows: ToolCheckoutRow[];
  rollup: ToolCheckoutRollup;
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  const rows: ToolCheckoutRow[] = [];
  for (const t of inputs.tools) {
    if (t.status === 'RETIRED') continue;

    let daysAssigned: number | null = null;
    if (t.status === 'ASSIGNED' && t.assignedAt) {
      daysAssigned = Math.max(
        0,
        daysBetween(t.assignedAt.slice(0, 10), asOf),
      );
    }

    let tier: ToolAssignmentTier;
    if (t.status === 'LOST' || t.status === 'OUT_FOR_REPAIR') {
      tier = 'LOST_OR_REPAIR';
    } else if (t.status === 'IN_YARD' || t.status === 'IN_SHOP') {
      tier = 'IN_YARD_OK';
    } else if (daysAssigned == null || daysAssigned < 30) {
      tier = 'CHECKED_OUT';
    } else if (daysAssigned < 60) {
      tier = 'AGED_30';
    } else {
      tier = 'AGED_60';
    }

    rows.push({
      toolId: t.id,
      name: t.name,
      category: t.category,
      status: t.status,
      assignedToEmployeeId: t.assignedToEmployeeId,
      assignedAt: t.assignedAt,
      daysAssigned,
      tier,
    });
  }

  const tierRank: Record<ToolAssignmentTier, number> = {
    AGED_60: 0,
    LOST_OR_REPAIR: 1,
    AGED_30: 2,
    CHECKED_OUT: 3,
    IN_YARD_OK: 4,
  };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
    const ad = a.daysAssigned ?? -1;
    const bd = b.daysAssigned ?? -1;
    return bd - ad;
  });

  let inYard = 0;
  let checkedOut = 0;
  let aged30 = 0;
  let aged60 = 0;
  let lostOrRepair = 0;
  for (const r of rows) {
    if (r.tier === 'IN_YARD_OK') inYard += 1;
    else if (r.tier === 'CHECKED_OUT') checkedOut += 1;
    else if (r.tier === 'AGED_30') aged30 += 1;
    else if (r.tier === 'AGED_60') aged60 += 1;
    else lostOrRepair += 1;
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      inYard,
      checkedOut,
      aged30,
      aged60,
      lostOrRepair,
    },
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
