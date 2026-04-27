import { describe, expect, it } from 'vitest';
import { buildSubScopeReport } from './sub-scope-grouping';
import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

function sub(over: Partial<SubBid>): SubBid {
  return {
    id: 'sub-1',
    contractorName: 'Acme',
    portionOfWork: 'paving',
    bidAmountCents: 50_000_00,
    ...over,
  } as SubBid;
}

function est(subBids: SubBid[]): Pick<PricedEstimate, 'id' | 'subBids'> {
  return { id: 'est-1', subBids } as Pick<PricedEstimate, 'id' | 'subBids'>;
}

describe('buildSubScopeReport', () => {
  it('groups subs by normalized scope', () => {
    const r = buildSubScopeReport({
      estimate: est([
        sub({ id: 'a', portionOfWork: 'Asphalt Paving', bidAmountCents: 100_00 }),
        sub({ id: 'b', portionOfWork: 'asphalt   paving', bidAmountCents: 200_00 }),
        sub({ id: 'c', portionOfWork: 'striping', bidAmountCents: 50_00 }),
      ]),
    });
    expect(r.rows).toHaveLength(2);
    const paving = r.rows.find((x) => x.scope.includes('paving'))!;
    expect(paving.subCount).toBe(2);
    expect(paving.totalCents).toBe(300_00);
  });

  it('display name = most-frequent raw casing', () => {
    const r = buildSubScopeReport({
      estimate: est([
        sub({ id: 'a', portionOfWork: 'Paving' }),
        sub({ id: 'b', portionOfWork: 'paving' }),
        sub({ id: 'c', portionOfWork: 'paving' }),
      ]),
    });
    expect(r.rows[0]?.displayScope).toBe('paving');
  });

  it('sorts highest spend first', () => {
    const r = buildSubScopeReport({
      estimate: est([
        sub({ id: 'a', portionOfWork: 'paving', bidAmountCents: 50_00 }),
        sub({ id: 'b', portionOfWork: 'striping', bidAmountCents: 200_00 }),
      ]),
    });
    expect(r.rows[0]?.scope).toBe('striping');
  });

  it('subs within scope sorted highest first', () => {
    const r = buildSubScopeReport({
      estimate: est([
        sub({ id: 'small', portionOfWork: 'paving', bidAmountCents: 100_00 }),
        sub({ id: 'big', portionOfWork: 'paving', bidAmountCents: 500_00 }),
      ]),
    });
    expect(r.rows[0]?.subs[0]?.subId).toBe('big');
  });

  it('skips blank portionOfWork', () => {
    const r = buildSubScopeReport({
      estimate: est([
        sub({ id: 'a', portionOfWork: '   ' }),
        sub({ id: 'b', portionOfWork: 'paving' }),
      ]),
    });
    expect(r.rows).toHaveLength(1);
  });

  it('handles empty subBids cleanly', () => {
    const r = buildSubScopeReport({
      estimate: est([]),
    });
    expect(r.rows).toHaveLength(0);
    expect(r.totalSubCents).toBe(0);
  });
});
