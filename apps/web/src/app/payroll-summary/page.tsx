// /payroll-summary — per-employee year-to-date payroll roll-up.
//
// Plain English: per-employee YTD hours + gross wages, derived from
// time cards × DIR rates active mid-year. Backs W-2 + 941 + DE-9
// reconciliation. Until real payroll lands in Phase 2, these are
// estimates — useful for sanity-checking what we're paying.

import Link from 'next/link';

import {
  AppShell,
  Card,
  Money,
  PageHeader,
  Tile,
} from '../../components';
import {
  buildPayrollSummary,
  computePayrollSummaryRollup,
  findRateInEffect,
  totalFringeCents,
  type DirClassification,
  type DirRate,
  type Employee,
  type PayrollSummaryRow,
  type TimeCard,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

export default async function PayrollSummaryPage({
  searchParams,
}: {
  searchParams: { year?: string; county?: string; taxRate?: string };
}) {
  const year = /^\d{4}$/.test(searchParams.year ?? '')
    ? Number(searchParams.year)
    : new Date().getFullYear();
  const county = searchParams.county?.trim() || 'Shasta';
  const employerTaxRate = (() => {
    const n = Number(searchParams.taxRate);
    if (!Number.isFinite(n)) return 0.2;
    return n > 1 ? n / 100 : n;
  })();

  const [employees, timeCards, dirRates] = await Promise.all([
    fetchJson<Employee>('/api/employees', 'employees'),
    fetchJson<TimeCard>('/api/time-cards', 'cards'),
    fetchJson<DirRate>('/api/dir-rates', 'rates'),
  ]);

  const asOf = `${year}-07-01`;
  const ratesByClassification = new Map<
    DirClassification,
    { baseCentsPerHour: number; fringeCentsPerHour: number }
  >();
  const classifications = new Set<DirClassification>(
    employees.map((e) => e.classification),
  );
  for (const c of classifications) {
    const rate = findRateInEffect(dirRates, { classification: c, county, asOf });
    if (rate) {
      ratesByClassification.set(c, {
        baseCentsPerHour: rate.basicHourlyCents,
        fringeCentsPerHour: totalFringeCents(rate),
      });
    }
  }

  const rows = buildPayrollSummary({
    year,
    employees,
    timeCards,
    ratesByClassification,
    employerTaxRate,
  });
  const visible = rows.filter((r) => r.totalHours > 0);
  const rollup = computePayrollSummaryRollup(visible);

  const missingRates = Array.from(classifications).filter(
    (c) => !ratesByClassification.has(c),
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title="Payroll year-end"
          subtitle="Per-employee YTD hours + gross wages, derived from time cards × DIR rates active mid-year. Backs W-2 + 941 + DE-9 reconciliation."
        />

        <form action="/payroll-summary" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Year</span>
            <input
              type="number"
              name="year"
              defaultValue={year}
              min="2000"
              max="2100"
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">County</span>
            <input
              name="county"
              defaultValue={county}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Employer tax rate (%)</span>
            <input
              type="number"
              step="0.1"
              name="taxRate"
              defaultValue={(employerTaxRate * 100).toFixed(1)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Reload
          </button>
        </form>

        {missingRates.length > 0 ? (
          <Card className="mb-4 border-amber-300 bg-amber-50">
            <p className="text-sm text-amber-900">
              <strong>Missing DIR rates for {missingRates.length} classification{missingRates.length === 1 ? '' : 's'}:</strong>{' '}
              {missingRates.join(', ')}. Add a DIR rate for {county} county at{' '}
              <Link href="/dir-rates/new" className="text-blue-700 hover:underline">/dir-rates/new</Link>{' '}
              before relying on these totals for W-2 prep.
            </p>
          </Card>
        ) : null}

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Employees" value={rollup.employees} />
          <Tile label="Total hours" value={rollup.totalHours.toFixed(1)} />
          <Tile label="Gross wages" value={<Money cents={rollup.totalGrossWagesCents} />} />
          <Tile label="Fringe (trust)" value={<Money cents={rollup.totalFringeCents} />} />
        </section>

        {visible.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No time cards in {year}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Classification</th>
                  <th className="px-3 py-2 text-right">Wks</th>
                  <th className="px-3 py-2 text-right">Reg hrs</th>
                  <th className="px-3 py-2 text-right">OT hrs</th>
                  <th className="px-3 py-2 text-right">Total hrs</th>
                  <th className="px-3 py-2 text-right">Base $/hr</th>
                  <th className="px-3 py-2 text-right">Reg wages</th>
                  <th className="px-3 py-2 text-right">OT wages</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Fringe</th>
                  <th className="px-3 py-2 text-right">Emp. tax est</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => (
                  <Row key={r.employeeId} row={r} />
                ))}
                <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-3 py-3 text-right uppercase tracking-wide">Totals</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalRegularHours.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalOvertimeHours.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalHours.toFixed(1)}</td>
                  <td colSpan={3} className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right"><Money cents={rollup.totalGrossWagesCents} /></td>
                  <td className="px-3 py-3 text-right"><Money cents={rollup.totalFringeCents} /></td>
                  <td className="px-3 py-3 text-right"><Money cents={rollup.totalEmployerTaxEstimateCents} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Estimates only — actual payroll runs (Phase 2) will produce the W-2 numbers.
          Fringe is paid into trust funds (H&amp;W / pension / vac), not on the W-2.
          Employer tax est. = gross × the rate above (FICA + FUTA + SUTA + workers comp blended).
        </p>
      </main>
    </AppShell>
  );
}

function Row({ row }: { row: PayrollSummaryRow }) {
  return (
    <tr>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{row.employeeName}</div>
        <div className="font-mono text-[10px] text-gray-500">{row.employeeId}</div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-700">{row.classificationLabel}</td>
      <td className="px-3 py-2 text-right font-mono text-xs">{row.weeksWorked}</td>
      <td className="px-3 py-2 text-right font-mono">{row.regularHours.toFixed(1)}</td>
      <td className="px-3 py-2 text-right font-mono">{row.overtimeHours.toFixed(1)}</td>
      <td className="px-3 py-2 text-right font-mono font-semibold">{row.totalHours.toFixed(1)}</td>
      <td className="px-3 py-2 text-right">
        {row.baseRateCentsPerHour > 0 ? <Money cents={row.baseRateCentsPerHour} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right"><Money cents={row.regularWagesCents} /></td>
      <td className="px-3 py-2 text-right">
        {row.overtimeWagesCents > 0 ? <Money cents={row.overtimeWagesCents} /> : <span className="font-mono text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right"><Money cents={row.grossWagesCents} className="font-semibold" /></td>
      <td className="px-3 py-2 text-right"><Money cents={row.fringeCents} /></td>
      <td className="px-3 py-2 text-right"><Money cents={row.employerTaxEstimateCents} /></td>
    </tr>
  );
}
