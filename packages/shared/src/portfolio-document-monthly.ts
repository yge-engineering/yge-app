// Portfolio document throughput by month.
//
// Plain English: per yyyy-mm, count the project paperwork
// flowing through the office — RFIs sent, submittals sent,
// PCOs noticed, change orders proposed, lien waivers
// generated. Drives the office-throughput chart.
//
// Per row: month, rfis, submittals, pcos, changeOrders,
// lienWaivers, total.
//
// Sort: month asc.
//
// Different from the per-stream monthly modules — this is the
// single combined document throughput row.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { LienWaiver } from './lien-waiver';
import type { Pco } from './pco';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

export interface PortfolioDocumentMonthlyRow {
  month: string;
  rfis: number;
  submittals: number;
  pcos: number;
  changeOrders: number;
  lienWaivers: number;
  total: number;
}

export interface PortfolioDocumentMonthlyRollup {
  monthsConsidered: number;
  totalRfis: number;
  totalSubmittals: number;
  totalPcos: number;
  totalChangeOrders: number;
  totalLienWaivers: number;
  totalDocuments: number;
}

export interface PortfolioDocumentMonthlyInputs {
  rfis: Rfi[];
  submittals: Submittal[];
  pcos: Pco[];
  changeOrders: ChangeOrder[];
  lienWaivers: LienWaiver[];
  /** Optional yyyy-mm bounds inclusive applied to relevant per-stream date. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioDocumentMonthly(
  inputs: PortfolioDocumentMonthlyInputs,
): {
  rollup: PortfolioDocumentMonthlyRollup;
  rows: PortfolioDocumentMonthlyRow[];
} {
  type Acc = {
    month: string;
    rfis: number;
    submittals: number;
    pcos: number;
    changeOrders: number;
    lienWaivers: number;
  };
  const accs = new Map<string, Acc>();

  let totalRfis = 0;
  let totalSubmittals = 0;
  let totalPcos = 0;
  let totalChangeOrders = 0;
  let totalLienWaivers = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function bump(month: string, field: keyof Omit<Acc, 'month'>): void {
    if (fromM && month < fromM) return;
    if (toM && month > toM) return;
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        rfis: 0,
        submittals: 0,
        pcos: 0,
        changeOrders: 0,
        lienWaivers: 0,
      };
      accs.set(month, a);
    }
    a[field] += 1;
  }

  for (const r of inputs.rfis) {
    if (!r.sentAt) continue;
    bump(r.sentAt.slice(0, 7), 'rfis');
    totalRfis += 1;
  }
  for (const s of inputs.submittals) {
    if (!s.submittedAt) continue;
    bump(s.submittedAt.slice(0, 7), 'submittals');
    totalSubmittals += 1;
  }
  for (const p of inputs.pcos) {
    bump(p.noticedOn.slice(0, 7), 'pcos');
    totalPcos += 1;
  }
  for (const co of inputs.changeOrders) {
    if (!co.proposedAt) continue;
    bump(co.proposedAt.slice(0, 7), 'changeOrders');
    totalChangeOrders += 1;
  }
  for (const lw of inputs.lienWaivers) {
    bump(lw.throughDate.slice(0, 7), 'lienWaivers');
    totalLienWaivers += 1;
  }

  const rows: PortfolioDocumentMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      rfis: a.rfis,
      submittals: a.submittals,
      pcos: a.pcos,
      changeOrders: a.changeOrders,
      lienWaivers: a.lienWaivers,
      total: a.rfis + a.submittals + a.pcos + a.changeOrders + a.lienWaivers,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalRfis,
      totalSubmittals,
      totalPcos,
      totalChangeOrders,
      totalLienWaivers,
      totalDocuments:
        totalRfis + totalSubmittals + totalPcos + totalChangeOrders + totalLienWaivers,
    },
    rows,
  };
}
