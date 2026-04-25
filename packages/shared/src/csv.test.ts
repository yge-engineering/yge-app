// Tests for the bid-item CSV helpers.
// These run in vitest with no I/O — pure string transforms.

import { describe, it, expect } from 'vitest';
import {
  bidItemsToCsv,
  csvEscape,
  BID_ITEM_CSV_HEADERS,
  pricedEstimateToCsv,
  PRICED_ESTIMATE_CSV_HEADERS,
} from './csv';
import type { PtoEBidItem } from './plans-to-estimate-output';
import type { PricedEstimate } from './priced-estimate';

describe('csvEscape', () => {
  it('passes plain values through unchanged', () => {
    expect(csvEscape('Mobilization')).toBe('Mobilization');
    expect(csvEscape(1234)).toBe('1234');
    expect(csvEscape('LS')).toBe('LS');
  });

  it('returns empty string for null / undefined', () => {
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(null)).toBe('');
  });

  it('quotes fields that contain a comma', () => {
    expect(csvEscape('HMA, Type A')).toBe('"HMA, Type A"');
  });

  it('quotes fields that contain a double quote and doubles it up', () => {
    expect(csvEscape('1/4-ton "Methods A & B"')).toBe(
      '"1/4-ton ""Methods A & B"""',
    );
  });

  it('quotes fields that contain a newline', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('bidItemsToCsv', () => {
  const items: PtoEBidItem[] = [
    {
      itemNumber: '1',
      description: 'Mobilization',
      unit: 'LS',
      quantity: 1,
      confidence: 'HIGH',
      pageReference: 'p. 12',
    },
    {
      itemNumber: '2',
      description: 'Riprap, 1/4-ton, Methods A & B',
      unit: 'TON',
      quantity: 510,
      confidence: 'MEDIUM',
      notes: 'Quantity per "as-built" cross-sections',
      pageReference: 'sheet C-3',
    },
  ];

  it('produces a header row matching BID_ITEM_CSV_HEADERS', () => {
    const out = bidItemsToCsv(items);
    const firstLine = out.split('\r\n')[0];
    expect(firstLine).toBe(BID_ITEM_CSV_HEADERS.join(','));
  });

  it('produces one row per bid item plus trailing newline', () => {
    const out = bidItemsToCsv(items);
    const lines = out.split('\r\n');
    // header + 2 items + trailing empty (from \r\n at end)
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
  });

  it('escapes notes that contain commas and quotes', () => {
    const out = bidItemsToCsv(items);
    // Item 2's description has commas — should be quoted.
    expect(out).toContain('"Riprap, 1/4-ton, Methods A & B"');
    // Notes has internal quotes — should be doubled up and the field quoted.
    expect(out).toContain('"Quantity per ""as-built"" cross-sections"');
  });

  it('emits empty fields for missing optional notes / pageReference', () => {
    const minimal: PtoEBidItem[] = [
      {
        itemNumber: '1',
        description: 'Test',
        unit: 'LS',
        quantity: 1,
        confidence: 'HIGH',
      },
    ];
    const out = bidItemsToCsv(minimal);
    const dataRow = out.split('\r\n')[1];
    expect(dataRow).toBe('1,Test,LS,1,HIGH,,');
  });

  it('returns just a header + trailing newline for an empty list', () => {
    const out = bidItemsToCsv([]);
    expect(out).toBe(BID_ITEM_CSV_HEADERS.join(',') + '\r\n');
  });
});

describe('pricedEstimateToCsv', () => {
  const baseEstimate: PricedEstimate = {
    id: 'est-2026-04-24-test-aaaaaaaa',
    fromDraftId: '2026-04-24-test-bbbbbbbb',
    jobId: 'cltest000000000000000000',
    createdAt: '2026-04-24T00:00:00Z',
    updatedAt: '2026-04-24T00:00:00Z',
    projectName: 'Test Job',
    projectType: 'DRAINAGE',
    bidItems: [
      {
        itemNumber: '1',
        description: 'Mobilization',
        unit: 'LS',
        quantity: 1,
        confidence: 'HIGH',
        unitPriceCents: 25_000_00, // $25,000
      },
      {
        itemNumber: '2',
        description: 'HMA, Type A',
        unit: 'TON',
        quantity: 100,
        confidence: 'MEDIUM',
        unitPriceCents: null, // not yet priced
      },
    ],
    oppPercent: 0.2,
  };

  it('produces a header row matching PRICED_ESTIMATE_CSV_HEADERS', () => {
    const out = pricedEstimateToCsv(baseEstimate);
    const firstLine = out.split('\r\n')[0];
    expect(firstLine).toBe(PRICED_ESTIMATE_CSV_HEADERS.join(','));
  });

  it('formats unit price + extended as plain decimal dollars', () => {
    const out = pricedEstimateToCsv(baseEstimate);
    // Item 1 priced: 1 * $25,000 = extended $25,000.00
    expect(out).toContain('1,Mobilization,LS,1,25000.00,25000.00,HIGH,,');
  });

  it('leaves unit price + extended blank for unpriced lines', () => {
    const out = pricedEstimateToCsv(baseEstimate);
    // Item 2 unpriced: blank cells for both columns. Description has a
    // comma so it gets quoted.
    expect(out).toContain('2,"HMA, Type A",TON,100,,,MEDIUM,,');
  });

  it('appends a totals block (direct cost / O&P / bid total)', () => {
    const out = pricedEstimateToCsv(baseEstimate);
    // Direct cost = 1 * 2_500_000 cents = 2_500_000 → $25,000.00
    // O&P 20% = 500_000 cents → $5,000.00
    // Bid total = 3_000_000 cents → $30,000.00
    expect(out).toContain(',,,,Direct cost,25000.00');
    expect(out).toContain(',,,,O&P (20.0%),5000.00');
    expect(out).toContain(',,,,Bid total,30000.00');
  });

  it('handles fully unpriced estimate (totals all zero)', () => {
    const fullyUnpriced: PricedEstimate = {
      ...baseEstimate,
      bidItems: baseEstimate.bidItems.map((it) => ({ ...it, unitPriceCents: null })),
    };
    const out = pricedEstimateToCsv(fullyUnpriced);
    expect(out).toContain(',,,,Direct cost,0.00');
    expect(out).toContain(',,,,Bid total,0.00');
  });
});
