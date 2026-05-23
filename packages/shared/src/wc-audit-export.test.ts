import { describe, it, expect } from 'vitest';
import {
  buildWcAuditExport,
  wcAuditCsvRows,
  WcPayrollLineSchema,
  type WcPayrollLine,
} from './wc-audit-export';

function line(over: Partial<WcPayrollLine>): WcPayrollLine {
  return WcPayrollLineSchema.parse({
    employeeName: 'Ryan',
    wcClassCode: '5474',
    year: 2026,
    regularWagesCents: 100_000,
    overtimeStraightCents: 0,
    overtimePremiumCents: 0,
    ...over,
  });
}

describe('buildWcAuditExport', () => {
  it('groups by class code, excludes OT premium from base', () => {
    const lines = [
      line({ employeeName: 'Ryan', wcClassCode: '5474', regularWagesCents: 200_000, overtimeStraightCents: 25_000, overtimePremiumCents: 12_500 }),
      line({ employeeName: 'Brook', wcClassCode: '5474', regularWagesCents: 300_000 }),
      line({ employeeName: 'Jose', wcClassCode: '8810', regularWagesCents: 100_000 }),
    ];
    const out = buildWcAuditExport(lines, 2026);
    expect(out.rollups).toHaveLength(2);
    const c5474 = out.rollups.find((r) => r.wcClassCode === '5474');
    expect(c5474?.auditableBaseCents).toBe(200_000 + 25_000 + 300_000); // 525,000
    expect(c5474?.totalOvertimePremiumCents).toBe(12_500);
    expect(c5474?.employees.sort()).toEqual(['Brook', 'Ryan']);
    expect(out.grandAuditableBaseCents).toBe(525_000 + 100_000);
    expect(out.grandOvertimePremiumCents).toBe(12_500);
  });

  it('filters by year', () => {
    const lines = [line({ year: 2025 }), line({ year: 2026 }), line({ year: 2027 })];
    const out = buildWcAuditExport(lines, 2026);
    expect(out.rollups[0]?.lineCount).toBe(1);
  });

  it('returns empty for no data', () => {
    const out = buildWcAuditExport([], 2026);
    expect(out.rollups).toEqual([]);
    expect(out.grandAuditableBaseCents).toBe(0);
  });
});

describe('wcAuditCsvRows', () => {
  it('produces headers + dollar-formatted rows', () => {
    const out = buildWcAuditExport(
      [line({ wcClassCode: '5474', regularWagesCents: 123_456 })],
      2026,
    );
    const csv = wcAuditCsvRows(out);
    expect(csv.headers[0]).toBe('WC class code');
    expect(csv.rows[0]?.[0]).toBe('5474');
    expect(csv.rows[0]?.[2]).toBe('1234.56');
  });
});
