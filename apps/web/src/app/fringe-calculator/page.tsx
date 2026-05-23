'use client';

import { useState } from 'react';
import { AppShell, Money, PageHeader, Tile } from '../../components';
import { calcFringe, FringeInputSchema, type FringeInput } from '@yge/shared';

export default function FringeCalculatorPage() {
  const [base, setBase] = useState('50.00');
  const [fringe, setFringe] = useState('20.00');
  const [hours, setHours] = useState('40');
  const [taxRate, setTaxRate] = useState('20');
  const [out, setOut] = useState<ReturnType<typeof calcFringe> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function compute() {
    setError(null);
    const input: FringeInput = {
      baseHourlyCents: Math.round(Number(base) * 100),
      fringeHourlyCents: Math.round(Number(fringe) * 100),
      hours: Number(hours),
      employerTaxRate: Number(taxRate) / 100,
    };
    const parsed = FringeInputSchema.safeParse(input);
    if (!parsed.success) {
      setError('Check the numbers — all must be ≥ 0 and tax rate 0–100%.');
      return;
    }
    setOut(calcFringe(parsed.data));
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <PageHeader
          title="Fringe-benefit cost calculator"
          subtitle="Cash-in-lieu vs paid-to-fund cost on the fringe portion of a PW wage. Paid-to-fund (qualified trust, pension, health) isn't subject to employer payroll taxes — that's the gap this surfaces."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Base hourly wage ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Hourly fringe ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={fringe}
              onChange={(e) => setFringe(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Hours">
            <input
              type="number"
              step="1"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Employer payroll-tax rate (%)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Default ~20%: FICA 7.65 + WC ~10 (heavy-civil) + UI/ETT ~2.
            </span>
          </Field>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={compute}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
          >
            Compute
          </button>
          {error ? <span className="ml-3 text-sm text-red-700">{error}</span> : null}
        </div>

        {out ? (
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <Tile label="Cash-in-lieu cost" value={<Money cents={out.cashInLieuTotalCents} />} />
            <Tile label="Paid-to-fund cost" value={<Money cents={out.paidToFundTotalCents} />} />
            <Tile
              label="Savings (paid-to-fund)"
              value={<Money cents={out.savingsTotalCents} />}
              tone={out.savingsTotalCents > 0 ? 'warn' : 'success'}
            />
            <Tile label="Savings / hour" value={<Money cents={out.savingsPerHourCents} />} />
            <Tile label="Annual (2,080 hr) savings" value={<Money cents={out.annualSavingsCents} />} />
            <Tile label="Cash-in-lieu payroll tax" value={<Money cents={out.cashInLieuPayrollTaxCents} />} />
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
