import { describe, it, expect } from 'vitest';
import {
  attentionAlerts,
  scanForPriceJumps,
  type MaterialPurchase,
} from './material-price-alert';

function p(over: Partial<MaterialPurchase>): MaterialPurchase {
  return {
    invoiceId: 'inv',
    postedOn: '2026-05-22',
    vendorName: 'Hat Creek Construction Materials',
    description: '3/4 in drain rock',
    unit: 'TON',
    unitPriceCents: 25_00,
    ...over,
  };
}

describe('scanForPriceJumps — happy path', () => {
  it('flags a +25% jump as warn (above warn threshold 22.5%, below critical 30%)', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 125_00 }), // +25%
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('warn');
    expect(alerts[0]!.changePct).toBe(0.25);
  });

  it('flags a +18% jump as info (above 15% threshold, below warn 22.5%)', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 118_00 }), // +18%
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe('info');
  });

  it('flags a +35% jump as critical', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 135_00 }),
    ]);
    expect(alerts[0]!.severity).toBe('critical');
  });

  it('flags a 16% drop as info', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 84_00 }), // -16%
    ]);
    expect(alerts[0]!.severity).toBe('info');
    expect(alerts[0]!.changePct).toBeLessThan(0);
  });

  it('does not flag a 5% jump (under default 15% threshold)', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 105_00 }),
    ]);
    expect(alerts).toHaveLength(0);
  });

  it('uses the normalized description for grouping (case + punctuation)', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', description: '3/4" Drain Rock', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', description: '3/4" drain rock', postedOn: '2026-05-01', unitPriceCents: 130_00 }),
    ]);
    expect(alerts).toHaveLength(1);
  });
});

describe('scanForPriceJumps — lookback', () => {
  it('ignores prior purchase further than lookbackDays ago', () => {
    const alerts = scanForPriceJumps(
      [
        p({ invoiceId: 'a', postedOn: '2024-01-01', unitPriceCents: 100_00 }),
        p({ invoiceId: 'b', postedOn: '2026-05-22', unitPriceCents: 200_00 }),
      ],
      { lookbackDays: 365 },
    );
    expect(alerts).toHaveLength(0);
  });

  it('includes when within lookback', () => {
    const alerts = scanForPriceJumps(
      [
        p({ invoiceId: 'a', postedOn: '2026-01-01', unitPriceCents: 100_00 }),
        p({ invoiceId: 'b', postedOn: '2026-05-22', unitPriceCents: 200_00 }),
      ],
      { lookbackDays: 365 },
    );
    expect(alerts).toHaveLength(1);
  });
});

describe('scanForPriceJumps — sort', () => {
  it('critical first, then warn, then info; ties broken by abs(changePct) desc', () => {
    const list: MaterialPurchase[] = [
      // 50% jump
      p({ invoiceId: '1a', description: 'A', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: '1b', description: 'A', postedOn: '2026-05-01', unitPriceCents: 150_00 }),
      // 25% jump (warn)
      p({ invoiceId: '2a', description: 'B', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: '2b', description: 'B', postedOn: '2026-05-01', unitPriceCents: 125_00 }),
      // 16% drop (info)
      p({ invoiceId: '3a', description: 'C', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: '3b', description: 'C', postedOn: '2026-05-01', unitPriceCents: 84_00 }),
    ];
    const alerts = scanForPriceJumps(list);
    expect(alerts.map((a) => a.severity)).toEqual(['critical', 'warn', 'info']);
  });
});

describe('attentionAlerts', () => {
  it('filters out info severity', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', description: 'A', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'b', description: 'A', postedOn: '2026-05-01', unitPriceCents: 84_00 }), // info drop
      p({ invoiceId: 'c', description: 'B', postedOn: '2026-04-01', unitPriceCents: 100_00 }),
      p({ invoiceId: 'd', description: 'B', postedOn: '2026-05-01', unitPriceCents: 130_00 }), // warn jump
    ]);
    expect(attentionAlerts(alerts).every((a) => a.severity !== 'info')).toBe(true);
    expect(attentionAlerts(alerts).length).toBeGreaterThan(0);
  });
});

describe('scanForPriceJumps — defensive', () => {
  it('skips zero-prior baseline (no divide by zero)', () => {
    const alerts = scanForPriceJumps([
      p({ invoiceId: 'a', postedOn: '2026-04-01', unitPriceCents: 0 }),
      p({ invoiceId: 'b', postedOn: '2026-05-01', unitPriceCents: 100_00 }),
    ]);
    expect(alerts).toHaveLength(0);
  });

  it('throws on negative threshold', () => {
    expect(() => scanForPriceJumps([], { thresholdPct: -0.1 })).toThrow();
  });
});
