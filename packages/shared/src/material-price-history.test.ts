import { describe, expect, it } from 'vitest';
import { buildMaterialPriceHistory } from './material-price-history';
import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';

function ap(over: Partial<ApInvoice>, lines: Partial<ApInvoiceLineItem>[] = []): ApInvoice {
  return {
    id: 'api-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Acme',
    invoiceDate: '2026-04-01',
    totalCents: 0,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: lines.map(
      (l) =>
        ({
          description: 'line',
          quantity: 1,
          unitPriceCents: 100_00,
          lineTotalCents: 100_00,
          ...l,
        }) as ApInvoiceLineItem,
    ),
    ...over,
  } as ApInvoice;
}

describe('buildMaterialPriceHistory', () => {
  it('groups by normalized description by default', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1' }, [
          { description: '3/4 Drain Rock', unitPriceCents: 25_00 },
          { description: '3/4   drain rock', unitPriceCents: 28_00 },
        ]),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.observations).toBe(2);
  });

  it('skips DRAFT + REJECTED invoices', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1', status: 'DRAFT' }, [
          { description: 'rebar', unitPriceCents: 1_000_00 },
        ]),
        ap({ id: '2', status: 'REJECTED' }, [
          { description: 'rebar', unitPriceCents: 9_000_00 },
        ]),
        ap({ id: '3', status: 'APPROVED' }, [
          { description: 'rebar', unitPriceCents: 100_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.observations).toBe(1);
  });

  it('skips lines with no unit price', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({}, [
          { description: 'a', unitPriceCents: 0 },
          { description: 'a', unitPriceCents: 100_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.observations).toBe(1);
  });

  it('detects RISING trend', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1', invoiceDate: '2026-01-01' }, [
          { description: 'rebar', unitPriceCents: 1_000_00 },
        ]),
        ap({ id: '2', invoiceDate: '2026-02-01' }, [
          { description: 'rebar', unitPriceCents: 1_050_00 },
        ]),
        ap({ id: '3', invoiceDate: '2026-04-01' }, [
          { description: 'rebar', unitPriceCents: 1_200_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.trend).toBe('RISING');
    expect(r.rows[0]?.totalChangeRate).toBeCloseTo(0.2, 4);
  });

  it('detects VOLATILE when min/max range is >50% of mean', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1' }, [
          { description: 'fuel', unitPriceCents: 100_00 },
          { description: 'fuel', unitPriceCents: 200_00 },
          { description: 'fuel', unitPriceCents: 50_00 },
        ]),
      ],
    });
    // mean ~117, range 150 → ratio 1.28 >> 0.5 → VOLATILE
    expect(r.rows[0]?.trend).toBe('VOLATILE');
  });

  it('STABLE when fewer than minObservationsForTrend samples', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1', invoiceDate: '2026-01-01' }, [
          { description: 'rebar', unitPriceCents: 1_000_00 },
        ]),
        ap({ id: '2', invoiceDate: '2026-04-01' }, [
          { description: 'rebar', unitPriceCents: 5_000_00 },
        ]),
      ],
      minObservationsForTrend: 3,
    });
    expect(r.rows[0]?.trend).toBe('STABLE');
  });

  it('groupByCostCode buckets by costCode when set', () => {
    const r = buildMaterialPriceHistory({
      groupByCostCode: true,
      apInvoices: [
        ap({}, [
          { description: 'thing one', costCode: '01-100', unitPriceCents: 100_00 },
          { description: 'thing two', costCode: '01-100', unitPriceCents: 110_00 },
        ]),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.observations).toBe(2);
  });

  it('first / latest / mean / min / max derived correctly', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1', invoiceDate: '2026-01-01' }, [
          { description: 'rebar', unitPriceCents: 100_00 },
        ]),
        ap({ id: '2', invoiceDate: '2026-02-15' }, [
          { description: 'rebar', unitPriceCents: 120_00 },
        ]),
        ap({ id: '3', invoiceDate: '2026-04-01' }, [
          { description: 'rebar', unitPriceCents: 110_00 },
        ]),
      ],
    });
    const row = r.rows[0]!;
    expect(row.firstUnitPriceCents).toBe(100_00);
    expect(row.latestUnitPriceCents).toBe(110_00);
    expect(row.minUnitPriceCents).toBe(100_00);
    expect(row.maxUnitPriceCents).toBe(120_00);
    expect(row.meanUnitPriceCents).toBe(110_00);
  });

  it('sorts highest recentDeltaFromMean first', () => {
    const r = buildMaterialPriceHistory({
      apInvoices: [
        ap({ id: '1', invoiceDate: '2026-01-01' }, [
          { description: 'cheap', unitPriceCents: 100_00 },
          { description: 'cheap', unitPriceCents: 100_00 },
          { description: 'cheap', unitPriceCents: 100_00 },
        ]),
        ap({ id: '2', invoiceDate: '2026-04-01' }, [
          { description: 'cheap', unitPriceCents: 100_00 }, // no delta
          { description: 'spike', unitPriceCents: 200_00 },
        ]),
        ap({ id: '3', invoiceDate: '2026-01-01' }, [
          { description: 'spike', unitPriceCents: 100_00 },
          { description: 'spike', unitPriceCents: 100_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.description).toBe('spike');
  });
});
