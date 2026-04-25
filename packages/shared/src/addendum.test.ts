import { describe, expect, it } from 'vitest';
import {
  AddendumSchema,
  allAddendaAcknowledged,
  sortedAddenda,
  unacknowledgedAddenda,
  type Addendum,
} from './addendum';

const a1: Addendum = {
  id: 'add-1',
  number: '1',
  dateIssued: '2026-04-15',
  subject: 'Schedule extension to 4/30',
  acknowledged: true,
};
const a2: Addendum = {
  id: 'add-2',
  number: '2',
  dateIssued: '2026-04-20',
  subject: 'Drawing C-3 revision',
  acknowledged: false,
};
const a10: Addendum = {
  id: 'add-10',
  number: '10',
  acknowledged: true,
};

describe('AddendumSchema', () => {
  it('accepts a minimal record (number + acknowledged only)', () => {
    const parsed = AddendumSchema.parse({
      id: 'add-x',
      number: '1',
      acknowledged: false,
    });
    expect(parsed.acknowledged).toBe(false);
    expect(parsed.dateIssued).toBeUndefined();
  });

  it('rejects empty number string', () => {
    expect(() =>
      AddendumSchema.parse({ id: 'x', number: '', acknowledged: true }),
    ).toThrow();
  });
});

describe('unacknowledgedAddenda', () => {
  it('returns only the un-acknowledged ones', () => {
    expect(unacknowledgedAddenda([a1, a2, a10])).toEqual([a2]);
  });

  it('returns empty when none logged', () => {
    expect(unacknowledgedAddenda([])).toEqual([]);
  });

  it('returns empty when all acknowledged', () => {
    expect(unacknowledgedAddenda([a1, a10])).toEqual([]);
  });
});

describe('allAddendaAcknowledged', () => {
  it('true when every entry acknowledged', () => {
    expect(allAddendaAcknowledged([a1, a10])).toBe(true);
  });

  it('false when any entry un-acknowledged', () => {
    expect(allAddendaAcknowledged([a1, a2])).toBe(false);
  });

  it('true on empty list (vacuous — no addenda issued)', () => {
    expect(allAddendaAcknowledged([])).toBe(true);
  });
});

describe('sortedAddenda', () => {
  it('sorts numerically, not lexically (10 > 2)', () => {
    const out = sortedAddenda([a10, a1, a2]);
    expect(out.map((a) => a.number)).toEqual(['1', '2', '10']);
  });

  it('handles agency prefixes like "Addendum 1"', () => {
    const list: Addendum[] = [
      { id: '1', number: 'Addendum 10', acknowledged: true },
      { id: '2', number: 'Addendum 1', acknowledged: true },
      { id: '3', number: 'Addendum 2', acknowledged: true },
    ];
    expect(sortedAddenda(list).map((a) => a.number)).toEqual([
      'Addendum 1',
      'Addendum 2',
      'Addendum 10',
    ]);
  });

  it('falls back to localeCompare when no numbers present', () => {
    const list: Addendum[] = [
      { id: '1', number: 'B', acknowledged: true },
      { id: '2', number: 'A', acknowledged: true },
    ];
    expect(sortedAddenda(list).map((a) => a.number)).toEqual(['A', 'B']);
  });

  it('does not mutate input', () => {
    const list = [a10, a1, a2];
    sortedAddenda(list);
    expect(list.map((a) => a.number)).toEqual(['10', '1', '2']);
  });
});
