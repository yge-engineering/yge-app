'use client';

// /labor-burden — burdened labor rate calculator.
//
// Wires labor-burden.ts into a real estimating tool. Inputs: base
// wage + fringe + burden rate overrides. Output: the burdened cost
// per hour, broken out by component, that should feed bid line-item
// rates instead of just base wage.

import { useMemo, useState } from 'react';
import {
  DEFAULT_BURDEN,
  computeBurdenedRate,
  type BurdenedRateInputs,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function LaborBurdenPage() {
  const [baseDollars, setBaseDollars] = useState('55.00');
  const [fringeDollars, setFringeDollars] = useState('22.00');
  const [ficaPct, setFicaPct] = useState(String(DEFAULT_BURDEN.ficaRate * 100));
  const [futaPct, setFutaPct] = useState(String(DEFAULT_BURDEN.futaRate * 100));
  const [sutaPct, setSutaPct] = useState(String(DEFAULT_BURDEN.sutaRate * 100));
  const [wcPct, setWcPct] = useState(String(DEFAULT_BURDEN.workersCompRate * 100));
  const [ptoReservePct, setPtoReservePct] = useState(String(DEFAULT_BURDEN.ptoReserveRate * 100));
  const [overheadPct, setOverheadPct] = useState(String(DEFAULT_BURDEN.generalOverheadRate * 100));

  const breakdown = useMemo(() => {
    const inputs: BurdenedRateInputs = {
      baseRateCentsPerHour: Math.round(Number(baseDollars) * 100) || 0,
      fringeCentsPerHour: Math.round(Number(fringeDollars) * 100) || 0,
      burden: {
        ficaRate: pctOrZero(ficaPct),
        futaRate: pctOrZero(futaPct),
        sutaRate: pctOrZero(sutaPct),
        workersCompRate: pctOrZero(wcPct),
        ptoReserveRate: pctOrZero(ptoReservePct),
        generalOverheadRate: pctOrZero(overheadPct),
      },
    };
    try {
      return computeBurdenedRate(inputs);
    } catch {
      return null;
    }
  }, [
    baseDollars,
    fringeDollars,
    ficaPct,
    futaPct,
    sutaPct,
    wcPct,
    ptoReservePct,
    overheadPct,
  ]);

  function loadDefaults() {
    setFicaPct(String(DEFAULT_BURDEN.ficaRate * 100));
    setFutaPct(String(DEFAULT_BURDEN.futaRate * 100));
    setSutaPct(String(DEFAULT_BURDEN.sutaRate * 100));
    setWcPct(String(DEFAULT_BURDEN.workersCompRate * 100));
    setPtoReservePct(String(DEFAULT_BURDEN.ptoReserveRate * 100));
    setOverheadPct(String(DEFAULT_BURDEN.generalOverheadRate * 100));
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Labor burden calculator"
          subtitle="Base + fringe is cash to the employee. Burdened rate is the cost to YGE — what bid line-item rates should reflect."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Wage inputs</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Base wage ($/h)">
                <input value={baseDollars} onChange={(e) => setBaseDollars(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Fringe ($/h)">
                <input value={fringeDollars} onChange={(e) => setFringeDollars(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <h3 className="mt-6 flex items-baseline justify-between text-sm font-semibold text-gray-700">
              <span>Burden rates (%)</span>
              <button
                type="button"
                onClick={loadDefaults}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Load defaults
              </button>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Employer FICA (7.65 default)">
                <input value={ficaPct} onChange={(e) => setFicaPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="FUTA (0.6 default)">
                <input value={futaPct} onChange={(e) => setFutaPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="SUTA — CA (3.4 default)">
                <input value={sutaPct} onChange={(e) => setSutaPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Workers comp (class-dependent)">
                <input value={wcPct} onChange={(e) => setWcPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="PTO + holiday reserve">
                <input value={ptoReservePct} onChange={(e) => setPtoReservePct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="General overhead">
                <input value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Burdened rate</h2>
            {breakdown ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Tile label="Base + fringe" value={fmtMoney(breakdown.baseRateCentsPerHour + breakdown.fringeCentsPerHour)} />
                  <Tile label="Total tax + burden" value={fmtMoney(breakdown.totalBurdenCentsPerHour)} />
                  <Tile label="Burdened total" value={fmtMoney(breakdown.burdenedRateCentsPerHour)} />
                  <Tile label="Loaded multiplier" value={`${breakdown.burdenMultiplier.toFixed(2)}×`} />
                </div>

                <h3 className="mt-6 text-sm font-semibold text-gray-700">Per-component breakdown ($/h)</h3>
                <table className="mt-2 w-full text-left text-sm">
                  <tbody>
                    <Row label="FICA" value={breakdown.ficaCentsPerHour} />
                    <Row label="FUTA" value={breakdown.futaCentsPerHour} />
                    <Row label="SUTA" value={breakdown.sutaCentsPerHour} />
                    <Row label="Workers comp" value={breakdown.workersCompCentsPerHour} />
                    <Row label="PTO reserve" value={breakdown.ptoReserveCentsPerHour} />
                    <Row label="General overhead" value={breakdown.generalOverheadCentsPerHour} />
                  </tbody>
                </table>

                <p className="mt-4 text-xs italic text-gray-500">
                  Plug the burdened total into bid line-item rates — base+fringe alone undershoots real cost by 25–35%.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Enter base wage + fringe to see the burdened rate.
              </p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-gray-200">
      <td className="py-1 text-gray-700">{label}</td>
      <td className="py-1 text-right font-mono">{fmtMoney(value)}</td>
    </tr>
  );
}

function pctOrZero(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : 0;
}
