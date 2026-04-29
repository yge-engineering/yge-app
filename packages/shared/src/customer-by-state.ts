// Customer count by state.
//
// Plain English: roll the customer master up by state. Heavy
// civil customers are mostly in-state agencies (Caltrans, BLM
// California, county PWs, school districts) but private/regional
// owners can come from out of state. Useful for the
// out-of-state-licensing review.
//
// Per row: state, total, distinctCustomers (always equals total
// since one customer = one row), totalCustomers... actually just
// total. Plus an onHoldCount + activeCount.
//
// Sort by total desc.
//
// Different from customer-concentration (\$), customer-lifetime
// (per-customer rollup). This is the geographic mix.
//
// Pure derivation. No persisted records.

import type { Customer } from './customer';

export interface CustomerByStateRow {
  state: string;
  total: number;
  activeCount: number;
  onHoldCount: number;
}

export interface CustomerByStateRollup {
  statesConsidered: number;
  totalCustomers: number;
  unattributed: number;
}

export interface CustomerByStateInputs {
  customers: Customer[];
}

export function buildCustomerByState(
  inputs: CustomerByStateInputs,
): {
  rollup: CustomerByStateRollup;
  rows: CustomerByStateRow[];
} {
  type Acc = {
    display: string;
    total: number;
    active: number;
    onHold: number;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;

  for (const c of inputs.customers) {
    const display = (c.state ?? '').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = display.toUpperCase();
    const acc = accs.get(key) ?? {
      display: key,
      total: 0,
      active: 0,
      onHold: 0,
    };
    acc.total += 1;
    const onHold = (c as { onHold?: boolean }).onHold === true;
    if (onHold) acc.onHold += 1;
    else acc.active += 1;
    accs.set(key, acc);
  }

  const rows: CustomerByStateRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      state: acc.display,
      total: acc.total,
      activeCount: acc.active,
      onHoldCount: acc.onHold,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      statesConsidered: rows.length,
      totalCustomers: inputs.customers.length,
      unattributed,
    },
    rows,
  };
}
