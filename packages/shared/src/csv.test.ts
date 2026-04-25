// Tests for the bid-item CSV helpers.
// These run in vitest with no I/O — pure string transforms.

import { describe, it, expect } from 'vitest';
import { bidItemsToCsv, csvEscape, BID_ITEM_CSV_HEADERS } from './csv';
import type { PtoEBidItem } from './plans-to-estimate-output';

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
