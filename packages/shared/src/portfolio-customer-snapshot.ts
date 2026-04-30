// Portfolio customer snapshot.
//
// Plain English: point-in-time count of every customer in the
// system, broken down by kind + state.
//
// Pure derivation. No persisted records.

import type { Customer, CustomerKind } from './customer';

export interface PortfolioCustomerSnapshotResult {
  totalCustomers: number;
  byKind: Partial<Record<CustomerKind, number>>;
  byState: Partial<Record<string, number>>;
  distinctStates: number;
}

export interface PortfolioCustomerSnapshotInputs {
  customers: Customer[];
}

export function buildPortfolioCustomerSnapshot(
  inputs: PortfolioCustomerSnapshotInputs,
): PortfolioCustomerSnapshotResult {
  const byKind = new Map<CustomerKind, number>();
  const byState = new Map<string, number>();

  for (const c of inputs.customers) {
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
    if (c.state) byState.set(c.state, (byState.get(c.state) ?? 0) + 1);
  }

  const kindOut: Partial<Record<CustomerKind, number>> = {};
  for (const [k, v] of byKind) kindOut[k] = v;
  const stateOut: Partial<Record<string, number>> = {};
  for (const [k, v] of byState) stateOut[k] = v;

  return {
    totalCustomers: inputs.customers.length,
    byKind: kindOut,
    byState: stateOut,
    distinctStates: byState.size,
  };
}
