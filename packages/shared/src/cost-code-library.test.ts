import { describe, expect, it } from 'vitest';
import { buildCostCodeLibrary } from './cost-code-library';
import type { ApInvoice, ApInvoiceLineItem } from './ap-invoice';
import type { TimeCard, TimeEntry } from './time-card';

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
          unitPriceCents: 0,
          lineTotalCents: 0,
          ...l,
        }) as ApInvoiceLineItem,
    ),
    ...over,
  } as ApInvoice;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'job-1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as TimeEntry;
}

function card(employeeId: string, entries: Partial<TimeEntry>[]): TimeCard {
  return {
    id: `tc-${employeeId}`,
    createdAt: '',
    updatedAt: '',
    employeeId,
    weekStarting: '2026-04-13',
    entries: entries.map((e) => entry(e)),
    status: 'APPROVED',
  } as TimeCard;
}

describe('buildCostCodeLibrary', () => {
  it('extracts unique codes from AP line items + time cards', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a', status: 'APPROVED' }, [
          { costCode: '01-100', lineTotalCents: 5_000_00, jobId: 'job-A' },
          { costCode: '02-200', lineTotalCents: 1_000_00, jobId: 'job-A' },
        ]),
      ],
      timeCards: [
        card('emp-1', [
          entry({ costCode: '03-300', date: '2026-04-15' }),
          entry({ costCode: '01-100', date: '2026-04-16' }),
        ]),
      ],
    });
    const codes = r.rows.map((x) => x.costCode).sort();
    expect(codes).toEqual(['01-100', '02-200', '03-300']);
  });

  it('counts AP lines and time entries separately', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: '01-100', lineTotalCents: 100_00, jobId: 'job-1' },
          { costCode: '01-100', lineTotalCents: 200_00, jobId: 'job-1' },
        ]),
      ],
      timeCards: [
        card('emp-1', [entry({ costCode: '01-100', date: '2026-04-15' })]),
      ],
    });
    const row = r.rows[0]!;
    expect(row.costCode).toBe('01-100');
    expect(row.usageByApLines).toBe(2);
    expect(row.usageByTimeEntries).toBe(1);
    expect(row.usageCount).toBe(3);
    expect(row.apDollarVolumeCents).toBe(300_00);
  });

  it('skips DRAFT and REJECTED AP invoices', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }, [
          { costCode: 'X', lineTotalCents: 99_999_00, jobId: 'job-A' },
        ]),
        ap({ id: 'r', status: 'REJECTED' }, [
          { costCode: 'Y', lineTotalCents: 99_999_00, jobId: 'job-A' },
        ]),
        ap({ id: 'a', status: 'APPROVED' }, [
          { costCode: 'Z', lineTotalCents: 100_00, jobId: 'job-A' },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rows.map((x) => x.costCode)).toEqual(['Z']);
  });

  it('merges case + whitespace variants by default; display = most-frequent', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: '  01-100  ', lineTotalCents: 100_00, jobId: 'job-A' },
          { costCode: '01-100', lineTotalCents: 100_00, jobId: 'job-A' },
          { costCode: '01-100', lineTotalCents: 100_00, jobId: 'job-A' },
          { costCode: '01-100', lineTotalCents: 100_00, jobId: 'job-A' },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.costCode).toBe('01-100'); // most-frequent variant
    expect(r.rows[0]?.usageByApLines).toBe(4);
  });

  it('keeps case variants distinct when mergeWhitespaceCase=false', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: 'WELDING', lineTotalCents: 100_00, jobId: 'job-A' },
          { costCode: 'welding', lineTotalCents: 100_00, jobId: 'job-A' },
        ]),
      ],
      timeCards: [],
      mergeWhitespaceCase: false,
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts distinct jobs per code', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: 'X', jobId: 'job-A', lineTotalCents: 100_00 },
          { costCode: 'X', jobId: 'job-B', lineTotalCents: 100_00 },
          { costCode: 'X', jobId: 'job-A', lineTotalCents: 100_00 },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('lastUsedOn picks the most recent date across AP + time entries', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-02-01' }, [
          { costCode: 'X', lineTotalCents: 100_00, jobId: 'job-A' },
        ]),
      ],
      timeCards: [
        card('emp-1', [entry({ costCode: 'X', date: '2026-04-20' })]),
      ],
    });
    expect(r.rows[0]?.lastUsedOn).toBe('2026-04-20');
  });

  it('rollup counts one-off codes (used exactly once)', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'TYPO', lineTotalCents: 100_00, jobId: 'j' },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rollup.totalCodes).toBe(2);
    expect(r.rollup.oneOffCount).toBe(1);
  });

  it('sorts by usage desc, then dollar volume desc', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: 'BIG', lineTotalCents: 5_000_00, jobId: 'j' },
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'BUSY', lineTotalCents: 100_00, jobId: 'j' },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rows.map((x) => x.costCode)).toEqual(['BUSY', 'BIG']);
  });

  it('skips line items with no costCode', () => {
    const r = buildCostCodeLibrary({
      apInvoices: [
        ap({ id: 'a' }, [
          { costCode: undefined, lineTotalCents: 100_00, jobId: 'j' },
          { costCode: '', lineTotalCents: 100_00, jobId: 'j' },
          { costCode: 'X', lineTotalCents: 100_00, jobId: 'j' },
        ]),
      ],
      timeCards: [],
    });
    expect(r.rows.map((x) => x.costCode)).toEqual(['X']);
  });
});
