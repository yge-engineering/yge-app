import { describe, expect, it } from 'vitest';

import type { Customer } from './customer';

import { buildCustomerByState } from './customer-by-state';

function cust(over: Partial<Customer>): Customer {
  return {
    id: 'c-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'CAL FIRE',
    state: 'CA',
    ...over,
  } as Customer;
}

describe('buildCustomerByState', () => {
  it('groups by state (uppercased)', () => {
    const r = buildCustomerByState({
      customers: [
        cust({ id: 'a', state: 'CA' }),
        cust({ id: 'b', state: 'ca' }),
        cust({ id: 'c', state: 'NV' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const ca = r.rows.find((x) => x.state === 'CA');
    expect(ca?.total).toBe(2);
  });

  it('counts unattributed (no state)', () => {
    const r = buildCustomerByState({
      customers: [
        cust({ id: 'a', state: 'CA' }),
        cust({ id: 'b', state: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by total desc', () => {
    const r = buildCustomerByState({
      customers: [
        cust({ id: 'a', state: 'NV' }),
        cust({ id: 'b', state: 'CA' }),
        cust({ id: 'c', state: 'CA' }),
        cust({ id: 'd', state: 'CA' }),
      ],
    });
    expect(r.rows[0]?.state).toBe('CA');
  });

  it('handles empty input', () => {
    const r = buildCustomerByState({ customers: [] });
    expect(r.rows).toHaveLength(0);
  });
});
