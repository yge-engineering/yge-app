import { describe, expect, it } from 'vitest';
import { buildCloseChecklist } from './close-checklist';
import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArInvoice } from './ar-invoice';
import type { DailyReport } from './daily-report';
import type { JournalEntry } from './journal-entry';
import type { SwpppInspection } from './swppp-inspection';

const ASOF = new Date('2026-05-15T00:00:00Z');

function emptyInputs() {
  return {
    month: '2026-04',
    journalEntries: [] as JournalEntry[],
    arInvoices: [] as ArInvoice[],
    apInvoices: [] as ApInvoice[],
    apPayments: [] as ApPayment[],
    dailyReports: [] as DailyReport[],
    swpppInspections: [] as SwpppInspection[],
    asOf: ASOF,
  };
}

describe('buildCloseChecklist', () => {
  it('uses correct month bounds (Apr → 04-01..04-30)', () => {
    const r = buildCloseChecklist(emptyInputs());
    expect(r.monthStart).toBe('2026-04-01');
    expect(r.monthEnd).toBe('2026-04-30');
  });

  it('Feb non-leap year gets 28 days, Feb leap year gets 29', () => {
    const r2025 = buildCloseChecklist({ ...emptyInputs(), month: '2025-02' });
    expect(r2025.monthEnd).toBe('2025-02-28');
    const r2024 = buildCloseChecklist({ ...emptyInputs(), month: '2024-02' });
    expect(r2024.monthEnd).toBe('2024-02-29');
  });

  it('flags out-of-balance books as a BLOCKER fail', () => {
    const r = buildCloseChecklist({
      ...emptyInputs(),
      journalEntries: [
        {
          id: 'je-1',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
          entryDate: '2026-04-15',
          memo: 'Out of balance',
          source: 'MANUAL',
          status: 'POSTED',
          lines: [
            { accountNumber: '10100', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 99_00 },
          ],
        } as JournalEntry,
      ],
    });
    const item = r.items.find((x) => x.id === 'BOOKS_BALANCED')!;
    expect(item.status).toBe('FAIL');
    expect(item.severity).toBe('BLOCKER');
    expect(r.readyToClose).toBe(false);
    expect(r.blockerCount).toBeGreaterThanOrEqual(1);
  });

  it('flags lingering DRAFT JEs as a BLOCKER fail', () => {
    const r = buildCloseChecklist({
      ...emptyInputs(),
      journalEntries: [
        {
          id: 'je-1',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
          entryDate: '2026-04-15',
          memo: 'Draft',
          source: 'MANUAL',
          status: 'DRAFT',
          lines: [
            { accountNumber: '10100', debitCents: 100_00, creditCents: 0 },
            { accountNumber: '40100', debitCents: 0, creditCents: 100_00 },
          ],
        } as JournalEntry,
      ],
    });
    const item = r.items.find((x) => x.id === 'NO_DRAFT_JES')!;
    expect(item.status).toBe('FAIL');
    expect(r.readyToClose).toBe(false);
  });

  it('readyToClose=true when only advisories warn', () => {
    const r = buildCloseChecklist({
      ...emptyInputs(),
      arInvoices: [
        {
          id: 'ar-1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          jobId: 'job-1',
          invoiceNumber: '1',
          customerName: 'Cal Fire',
          invoiceDate: '2026-01-01', // > 60 days old at asOf 2026-05-15
          source: 'MANUAL',
          lineItems: [],
          subtotalCents: 50_000_00,
          totalCents: 50_000_00,
          paidCents: 0,
          status: 'SENT',
        } as ArInvoice,
      ],
    });
    const ar = r.items.find((x) => x.id === 'AR_OVER_60')!;
    expect(ar.status).toBe('WARN');
    expect(r.readyToClose).toBe(true);
    expect(r.warnCount).toBeGreaterThanOrEqual(1);
  });

  it('counts only weekday gaps in daily reports', () => {
    // April 2026: Wed 4/1 .. Thu 4/30. With no reports, all weekdays missing.
    const r = buildCloseChecklist(emptyInputs());
    const item = r.items.find((x) => x.id === 'DAILY_REPORTS')!;
    // April 2026 has 22 weekdays.
    expect(item.detail).toContain('22 workday');
  });

  it('SWPPP weekly check passes when every week has at least one inspection', () => {
    const inspections: SwpppInspection[] = [
      // April 2026 ISO weeks (Monday starts): 03-30, 04-06, 04-13, 04-20, 04-27.
      // The week of Mar 30 extends into April (Wed 4/1 – Sun 4/5), so log
      // its inspection on 04-01 — buildCloseChecklist only counts inspections
      // dated inside the month being closed.
      ...['2026-04-01', '2026-04-06', '2026-04-13', '2026-04-20', '2026-04-27'].map(
        (date, i) =>
          ({
            id: `swp-${i + 1}`,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            jobId: 'job-1',
            inspectedOn: date,
            trigger: 'WEEKLY',
            inspectorName: 'Ryan D. Young',
            rainForecast: false,
            qualifyingRainEvent: false,
            dischargeOccurred: false,
            bmpChecks: [],
          }) as SwpppInspection,
      ),
    ];
    const r = buildCloseChecklist({ ...emptyInputs(), swpppInspections: inspections });
    const item = r.items.find((x) => x.id === 'SWPPP_WEEKLY')!;
    expect(item.status).toBe('PASS');
  });
});
