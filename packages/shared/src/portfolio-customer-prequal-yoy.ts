// Portfolio customer-master YoY snapshot.
//
// Plain English: take a year-end snapshot of customers in the
// system. Counts active vs onHold + kind mix + state mix.
// Sized for the customer-master year-over-year compliance
// review.
//
// Pure derivation. No persisted records.

import type { Customer, CustomerKind } from './customer';

export interface PortfolioCustomerPrequalYoyBucket {
  totalCustomers: number;
  byKind: Partial<Record<CustomerKind, number>>;
  byState: Partial<Record<string, number>>;
}

export interface PortfolioCustomerPrequalYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioCustomerPrequalYoyBucket;
  current: PortfolioCustomerPrequalYoyBucket;
  totalCustomersDelta: number;
}

export interface PortfolioCustomerPrequalYoyInputs {
  customers: Customer[];
  currentYear: number;
}

function snapshot(customers: Customer[], asOfYear: number): PortfolioCustomerPrequalYoyBucket {
  const asOfStamp = `${asOfYear}-12-31T23:59:59.999Z`;
  let totalCustomers = 0;
  const byKind = new Map<CustomerKind, number>();
  const byState = new Map<string, number>();

  for (const c of customers) {
    if (c.createdAt > asOfStamp) continue;
    totalCustomers += 1;
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
    if (c.state) {
      byState.set(c.state, (byState.get(c.state) ?? 0) + 1);
    }
  }

  const kindOut: Partial<Record<CustomerKind, number>> = {};
  for (const [k, v] of byKind) kindOut[k] = v;
  const stateOut: Partial<Record<string, number>> = {};
  for (const [k, v] of byState) stateOut[k] = v;

  return { totalCustomers, byKind: kindOut, byState: stateOut };
}

export function buildPortfolioCustomerPrequalYoy(
  inputs: PortfolioCustomerPrequalYoyInputs,
): PortfolioCustomerPrequalYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.customers, priorYear);
  const current = snapshot(inputs.customers, inputs.currentYear);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    totalCustomersDelta: current.totalCustomers - prior.totalCustomers,
  };
}
