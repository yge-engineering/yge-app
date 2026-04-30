import { describe, expect, it } from 'vitest';

import type { Customer } from './customer';

import { buildPortfolioCustomerPrequalYoy } from './portfolio-customer-prequal-yoy';

function cust(over: Partial<Customer>): Customer {
  return {
    id: 'c-1',
    createdAt: '2025-06-15T00:00:00.000Z',
    updatedAt: '2025-06-15T00:00:00.000Z',
    legalName: 'CAL FIRE',
    kind: 'STATE_AGENCY',
    state: 'CA',
    ...over,
  } as Customer;
}

describe('buildPortfolioCustomerPrequalYoy', () => {
  it('compares year-end customer counts', () => {
    const r = buildPortfolioCustomerPrequalYoy({
      currentYear: 2026,
      customers: [
        cust({ id: 'a', createdAt: '2025-01-15T00:00:00Z' }),
        cust({ id: 'b', createdAt: '2026-06-15T00:00:00Z' }),
      ],
    });
    expect(r.prior.totalCustomers).toBe(1);
    expect(r.current.totalCustomers).toBe(2);
    expect(r.totalCustomersDelta).toBe(1);
  });

  it('breaks down by kind + state', () => {
    const r = buildPortfolioCustomerPrequalYoy({
      currentYear: 2026,
      customers: [
        cust({ id: 'a', kind: 'STATE_AGENCY', state: 'CA' }),
        cust({ id: 'b', kind: 'COUNTY', state: 'CA' }),
        cust({ id: 'c', kind: 'STATE_AGENCY', state: 'NV' }),
      ],
    });
    expect(r.current.byKind.STATE_AGENCY).toBe(2);
    expect(r.current.byKind.COUNTY).toBe(1);
    expect(r.current.byState.CA).toBe(2);
    expect(r.current.byState.NV).toBe(1);
  });

  it('skips customers created after snapshot date', () => {
    const r = buildPortfolioCustomerPrequalYoy({
      currentYear: 2026,
      customers: [cust({ id: 'a', createdAt: '2027-01-15T00:00:00Z' })],
    });
    expect(r.current.totalCustomers).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerPrequalYoy({ currentYear: 2026, customers: [] });
    expect(r.current.totalCustomers).toBe(0);
  });
});
