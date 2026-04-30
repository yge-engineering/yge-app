import { describe, expect, it } from 'vitest';

import type { Customer } from './customer';

import { buildPortfolioCustomerSnapshot } from './portfolio-customer-snapshot';

function cust(over: Partial<Customer>): Customer {
  return {
    id: 'c-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'CAL FIRE',
    kind: 'STATE_AGENCY',
    state: 'CA',
    ...over,
  } as Customer;
}

describe('buildPortfolioCustomerSnapshot', () => {
  it('counts total + kind + state mix', () => {
    const r = buildPortfolioCustomerSnapshot({
      customers: [
        cust({ id: 'a', kind: 'STATE_AGENCY', state: 'CA' }),
        cust({ id: 'b', kind: 'COUNTY', state: 'CA' }),
        cust({ id: 'c', kind: 'STATE_AGENCY', state: 'NV' }),
      ],
    });
    expect(r.totalCustomers).toBe(3);
    expect(r.byKind.STATE_AGENCY).toBe(2);
    expect(r.byKind.COUNTY).toBe(1);
    expect(r.byState.CA).toBe(2);
    expect(r.byState.NV).toBe(1);
    expect(r.distinctStates).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCustomerSnapshot({ customers: [] });
    expect(r.totalCustomers).toBe(0);
  });
});
