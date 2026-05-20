import { describe, expect, it } from 'vitest';
import { buildQboCoaImport } from './qbo-coa-import-build';
import type { QboCoaRow } from './qbo-coa-import';

function row(over: Partial<QboCoaRow> & { fullName: string; qboType: string }): QboCoaRow {
  return { ...over };
}

describe('buildQboCoaImport', () => {
  it('keeps a usable QBO number and maps the type', () => {
    const res = buildQboCoaImport([
      row({ number: '10000', fullName: 'Checking', qboType: 'Bank' }),
    ]);
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0]).toMatchObject({
      number: '10000',
      name: 'Checking',
      type: 'ASSET',
      active: true,
      sourceFullName: 'Checking',
    });
    expect(res.warnings).toEqual([]);
  });

  it('auto-assigns numbers by type when QBO had none', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Checking', qboType: 'Bank' }),
      row({ fullName: 'Savings', qboType: 'Bank' }),
      row({ fullName: 'Office Rent', qboType: 'Expense' }),
    ]);
    const byName = Object.fromEntries(res.accounts.map((a) => [a.name, a.number]));
    expect(byName['Checking']).toBe('10000');
    expect(byName['Savings']).toBe('10010');
    expect(byName['Office Rent']).toBe('60000');
  });

  it('rebuilds the parent hierarchy from colon-nested names', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Job Expenses', qboType: 'Cost of Goods Sold' }),
      row({ fullName: 'Job Expenses:Subcontracts', qboType: 'Cost of Goods Sold' }),
    ]);
    const parent = res.accounts.find((a) => a.name === 'Job Expenses')!;
    const child = res.accounts.find((a) => a.name === 'Subcontracts')!;
    expect(child.parentNumber).toBe(parent.number);
  });

  it('warns + leaves top-level when the parent is not in the import', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Job Expenses:Subcontracts', qboType: 'Cost of Goods Sold' }),
    ]);
    const child = res.accounts.find((a) => a.name === 'Subcontracts')!;
    expect(child.parentNumber).toBeUndefined();
    expect(res.warnings.some((w) => w.includes('Subcontracts'))).toBe(true);
  });

  it('collects unmapped rows for unknown types', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Weird Account', qboType: 'Mystery' }),
      row({ fullName: 'Checking', qboType: 'Bank' }),
    ]);
    expect(res.accounts).toHaveLength(1);
    expect(res.unmapped).toHaveLength(1);
    expect(res.unmapped[0]!.fullName).toBe('Weird Account');
  });

  it('warns when a QBO number sits in the wrong type range', () => {
    const res = buildQboCoaImport([
      // 60000 normally = expense, but this is mapped to Bank (asset).
      row({ number: '60000', fullName: 'Odd Bank', qboType: 'Bank' }),
    ]);
    expect(res.accounts[0]!.number).toBe('60000');
    expect(res.warnings.some((w) => w.includes('different account type'))).toBe(true);
  });

  it('reassigns + warns when a QBO number collides', () => {
    const res = buildQboCoaImport([
      row({ number: '10000', fullName: 'Checking', qboType: 'Bank' }),
      row({ number: '10000', fullName: 'Checking 2', qboType: 'Bank' }),
    ]);
    const numbers = res.accounts.map((a) => a.number);
    expect(new Set(numbers).size).toBe(2);
    expect(res.warnings.some((w) => w.includes('already taken'))).toBe(true);
  });

  it('skips + warns on a duplicate account name', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Checking', qboType: 'Bank' }),
      row({ fullName: 'Checking', qboType: 'Bank' }),
    ]);
    expect(res.accounts).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });

  it('records the QBO detail type as a description', () => {
    const res = buildQboCoaImport([
      row({ fullName: 'Checking', qboType: 'Bank', detailType: 'Checking' }),
    ]);
    expect(res.accounts[0]!.description).toContain('Checking');
  });
});
