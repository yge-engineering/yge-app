'use client';

// /cash-runway — week-by-week cash projection.
//
// Wires bundle 2529. User enters starting balance + a CSV of
// scheduled in/outflows; page shows the running weekly balance,
// highlights the lowest week, and surfaces the first negative
// week if any.

import { useMemo, useState } from 'react';
import {
  CashFlowItemSchema,
  buildCashRunway,
  type CashFlowItem,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

const SEED = `# Paste rows like: kind, yyyy-mm-dd, dollars, description
# kind = IN or OUT.  Lines starting with # are ignored.
IN,  2026-06-05,  120000, Mendocino progress draw
OUT, 2026-05-23,   42000, Payroll Fri
OUT, 2026-05-30,   42000, Payroll Fri
OUT, 2026-05-27,   18500, Fuel + materials
IN,  2026-06-12,  150000, CalFire retention release
OUT, 2026-06-06,   42000, Payroll Fri
OUT, 2026-06-13,   42000, Payroll Fri
OUT, 2026-06-10,   12500, Bond premium`;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseCsv(text: string): { items: CashFlowItem[]; errors: string[] } {
  const items: CashFlowItem[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 4) {
        errors.push(`Line ${idx + 1}: need kind, date, dollars, description`);
        return;
      }
      const [kindRaw, dateRaw, dollarsRaw, ...descParts] = cols;
      const kind = /^in$/i.test(kindRaw ?? '')
        ? 'INFLOW'
        : /^out$/i.test(kindRaw ?? '')
          ? 'OUTFLOW'
          : null;
      if (!kind) {
        errors.push(`Line ${idx + 1}: kind must be IN or OUT (got "${kindRaw}")`);
        return;
      }
      const dollars = Number(dollarsRaw);
      if (!Number.isFinite(dollars) || dollars < 0) {
        errors.push(`Line ${idx + 1}: bad dollars "${dollarsRaw}"`);
        return;
      }
      const parsed = CashFlowItemSchema.safeParse({
        id: `r${idx + 1}`,
        kind,
        expectedOn: dateRaw,
        amountCents: Math.round(dollars * 100),
        description: descParts.join(',').trim() || `Line ${idx + 1}`,
      });
      if (!parsed.success) {
        errors.push(`Line ${idx + 1}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
        return;
      }
      items.push(parsed.data);
    });
  return { items, errors };
}

function fmtMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CashRunwayPage() {
  const [startingDollars, setStartingDollars] = useState('250000');
  const [asOf, setAsOf] = useState(todayIso);
  const [horizon, setHorizon] = useState('8');
  const [csv, setCsv] = useState(SEED);

  const { items, errors } = useMemo(() => parseCsv(csv), [csv]);
  const report = useMemo(() => {
    try {
      return buildCashRunway({
        startingBalanceCents: Math.round((Number(startingDollars) || 0) * 100),
        asOfDate: asOf,
        horizonWeeks: Math.max(1, Number(horizon) || 1),
        items,
      });
    } catch {
      return null;
    }
  }, [startingDollars, asOf, horizon, items]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <PageHeader
          title="Cash runway"
          subtitle="Week-by-week projection of running cash from a starting balance + scheduled in/outflows. Highlights the lowest week + the first time the balance goes negative."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Setup</h2>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Starting balance ($)">
                <input
                  value={startingDollars}
                  onChange={(e) => setStartingDollars(e.target.value)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
              <Field label="As of date">
                <input
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Horizon (weeks)">
                <input
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  className={`${INPUT} font-mono`}
                />
              </Field>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-gray-700">
              Scheduled cash flows (CSV)
            </h3>
            <p className="text-xs text-gray-500">
              kind (IN/OUT), yyyy-mm-dd, dollars, description.
              Lines starting with # are ignored.
            </p>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={12}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            {errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Projection</h2>
            {report ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Tile label="Lowest" value={fmtMoney(report.lowestBalanceCents)} />
                  <Tile label="Ending balance" value={fmtMoney(report.endingBalanceCents)} />
                  <Tile label="Weeks to dip" value={String(report.weeksUntilLowest)} />
                  <Tile
                    label="First negative"
                    value={report.firstNegativeWeek ?? 'Never'}
                  />
                </div>

                {report.firstNegativeWeek && (
                  <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                    Balance projected negative in the week of {report.firstNegativeWeek}.
                    Pull in a receivable or push out a payable.
                  </p>
                )}

                <table className="mt-4 w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-2">Week of</th>
                      <th className="py-2 text-right">In</th>
                      <th className="py-2 text-right">Out</th>
                      <th className="py-2 text-right">Net</th>
                      <th className="py-2 text-right">Ending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.weeks.map((w) => (
                      <tr
                        key={w.weekStarting}
                        className={`border-t border-gray-200 ${
                          w.isLowest ? 'bg-amber-50' : w.endingBalanceCents < 0 ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="py-2 font-mono text-xs">{w.weekStarting}</td>
                        <td className="py-2 text-right font-mono text-green-700">
                          {fmtMoney(w.inflowCents)}
                        </td>
                        <td className="py-2 text-right font-mono text-red-700">
                          {fmtMoney(w.outflowCents)}
                        </td>
                        <td className="py-2 text-right font-mono">{fmtMoney(w.netCents)}</td>
                        <td
                          className={`py-2 text-right font-mono font-semibold ${
                            w.endingBalanceCents < 0
                              ? 'text-red-700'
                              : w.isLowest
                                ? 'text-amber-700'
                                : 'text-gray-900'
                          }`}
                        >
                          {fmtMoney(w.endingBalanceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Set a starting balance and horizon to see the projection.
              </p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
