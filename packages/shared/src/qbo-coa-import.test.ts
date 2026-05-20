import { describe, expect, it } from 'vitest';
import {
  coaRowsFromCsv,
  mapQboAccountType,
  splitQboAccountName,
} from './qbo-coa-import';

describe('mapQboAccountType', () => {
  it('maps the asset family', () => {
    for (const t of [
      'Bank',
      'Accounts Receivable',
      'Other Current Asset',
      'Fixed Asset',
      'Other Asset',
    ]) {
      expect(mapQboAccountType(t)).toBe('ASSET');
    }
  });

  it('maps the liability family', () => {
    for (const t of [
      'Accounts Payable',
      'Credit Card',
      'Other Current Liability',
      'Long Term Liability',
    ]) {
      expect(mapQboAccountType(t)).toBe('LIABILITY');
    }
  });

  it('maps equity, income, COGS, expense, other income/expense', () => {
    expect(mapQboAccountType('Equity')).toBe('EQUITY');
    expect(mapQboAccountType('Income')).toBe('REVENUE');
    expect(mapQboAccountType('Cost of Goods Sold')).toBe('COGS');
    expect(mapQboAccountType('Expense')).toBe('EXPENSE');
    expect(mapQboAccountType('Other Income')).toBe('OTHER_INCOME');
    expect(mapQboAccountType('Other Expense')).toBe('OTHER_EXPENSE');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(mapQboAccountType('  bank ')).toBe('ASSET');
    expect(mapQboAccountType('OTHER CURRENT   LIABILITY')).toBe('LIABILITY');
  });

  it('returns null for an unknown type', () => {
    expect(mapQboAccountType('Mystery')).toBeNull();
    expect(mapQboAccountType('')).toBeNull();
  });
});

describe('splitQboAccountName', () => {
  it('returns just the leaf for a top-level account', () => {
    expect(splitQboAccountName('Bank')).toEqual({ leafName: 'Bank' });
  });

  it('splits parent:child', () => {
    expect(splitQboAccountName('Job Expenses:Subcontracts')).toEqual({
      parentName: 'Job Expenses',
      leafName: 'Subcontracts',
    });
  });

  it('keeps deep parents joined', () => {
    expect(splitQboAccountName('A:B:C')).toEqual({
      parentName: 'A:B',
      leafName: 'C',
    });
  });

  it('trims whitespace around segments', () => {
    expect(splitQboAccountName('Parent : Child')).toEqual({
      parentName: 'Parent',
      leafName: 'Child',
    });
  });
});

describe('coaRowsFromCsv', () => {
  it('parses a typical QBO export with header variants', () => {
    const csv =
      'Account Number,Account Name,Type,Detail Type,Balance\n' +
      '10000,Checking,Bank,Checking,"12,500.00"\n' +
      ',Job Expenses:Subcontracts,Cost of Goods Sold,Subcontractors,\n';
    const rows = coaRowsFromCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      number: '10000',
      fullName: 'Checking',
      qboType: 'Bank',
      detailType: 'Checking',
      balanceRaw: '12,500.00',
    });
    expect(rows[1]!.number).toBeUndefined();
    expect(rows[1]!.fullName).toBe('Job Expenses:Subcontracts');
    expect(rows[1]!.qboType).toBe('Cost of Goods Sold');
  });

  it('tolerates the shorter "Name"/"Type" header spelling', () => {
    const csv = 'Name,Type\nOffice Rent,Expense\n';
    const rows = coaRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fullName).toBe('Office Rent');
    expect(rows[0]!.qboType).toBe('Expense');
  });

  it('skips blank/summary lines with no name and no type', () => {
    const csv = 'Account Name,Type\nBank Account,Bank\n,\n';
    const rows = coaRowsFromCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it('returns [] for an empty file', () => {
    expect(coaRowsFromCsv('')).toEqual([]);
  });
});
