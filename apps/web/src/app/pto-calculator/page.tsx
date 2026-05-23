'use client';

// /pto-calculator — CA sick-leave + PTO accrual calculator.
//
// Wires bundle 2480's pure helpers into a small office tool. The
// bookkeeper enters an employee's plan + their current balance + how
// many hours they worked this pay period, and sees:
//   - the new balance after this period's accrual
//   - the year-to-date used + remaining cap
//   - CA-statutory compliance issues with the plan itself
//   - termination payout obligation (in hours)
//
// Pure client side — accrueForPayPeriod / usePto / validateCaCompliance
// run in-browser. No API hop, no persisted state yet. Future bundle
// adds a PtoBalance Prisma table + per-employee dashboard.

import { useMemo, useState } from 'react';
import {
  CA_STATUTORY_SICK_PLAN,
  PtoBalanceSchema,
  PtoPlanSchema,
  accrueForPayPeriod,
  isEligibleToUse,
  terminationPayoutHours,
  validateCaCompliance,
  type PtoPlan,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

export default function PtoCalculatorPage() {
  // Plan inputs (default = the CA statutory minimum sick plan).
  const [planName, setPlanName] = useState(CA_STATUTORY_SICK_PLAN.name);
  const [planType, setPlanType] = useState<PtoPlan['type']>(CA_STATUTORY_SICK_PLAN.type);
  const [accrualMethod, setAccrualMethod] = useState<PtoPlan['accrualMethod']>(CA_STATUTORY_SICK_PLAN.accrualMethod);
  const [accrualPer30, setAccrualPer30] = useState(String(CA_STATUTORY_SICK_PLAN.accrualPer30HoursWorked ?? 1));
  const [frontload, setFrontload] = useState(String(CA_STATUTORY_SICK_PLAN.frontloadHoursPerYear ?? 40));
  const [usableCap, setUsableCap] = useState(String(CA_STATUTORY_SICK_PLAN.usableCapHours));
  const [carryoverCap, setCarryoverCap] = useState(String(CA_STATUTORY_SICK_PLAN.carryoverCapHours));
  const [eligibilityDays, setEligibilityDays] = useState(String(CA_STATUTORY_SICK_PLAN.eligibilityDays));
  const [payoutOnTerm, setPayoutOnTerm] = useState(CA_STATUTORY_SICK_PLAN.payoutOnTerm);

  // Balance inputs.
  const [employeeId, setEmployeeId] = useState('emp-demo');
  const [hireDate, setHireDate] = useState('2026-01-01');
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [balanceHours, setBalanceHours] = useState('0');
  const [usedThisYear, setUsedThisYear] = useState('0');
  const [hoursWorked, setHoursWorked] = useState('30');

  const plan = useMemo(() => {
    const raw: Record<string, unknown> = {
      id: 'calc-plan',
      name: planName,
      type: planType,
      accrualMethod,
      usableCapHours: Number(usableCap) || 0,
      carryoverCapHours: Number(carryoverCap) || 0,
      eligibilityDays: Number(eligibilityDays) || 0,
      payoutOnTerm,
    };
    if (accrualMethod === 'HOURLY') {
      raw.accrualPer30HoursWorked = Number(accrualPer30) || 0;
    } else {
      raw.frontloadHoursPerYear = Number(frontload) || 0;
    }
    const parsed = PtoPlanSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }, [
    planName,
    planType,
    accrualMethod,
    accrualPer30,
    frontload,
    usableCap,
    carryoverCap,
    eligibilityDays,
    payoutOnTerm,
  ]);

  const balance = useMemo(() => {
    if (!plan) return null;
    const parsed = PtoBalanceSchema.safeParse({
      employeeId,
      planId: plan.id,
      balanceHours: Number(balanceHours) || 0,
      usedThisYearHours: Number(usedThisYear) || 0,
      asOfDate,
    });
    return parsed.success ? parsed.data : null;
  }, [plan, employeeId, balanceHours, usedThisYear, asOfDate]);

  const accruedThisPeriod = useMemo(() => {
    if (!plan || !balance) return null;
    if (plan.accrualMethod !== 'HOURLY') return null;
    try {
      const h = Number(hoursWorked) || 0;
      const next = accrueForPayPeriod(plan, balance, h, asOfDate);
      return { delta: round2(next.balanceHours - balance.balanceHours), next };
    } catch {
      return null;
    }
  }, [plan, balance, hoursWorked, asOfDate]);

  const issues = plan ? validateCaCompliance(plan) : [];
  const eligible = plan ? isEligibleToUse(plan, hireDate, asOfDate) : false;
  const payoutHours = plan && balance ? terminationPayoutHours(plan, balance) : 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="PTO / sick-leave calculator"
          subtitle="CA Labor Code §246 (SB 616). Edit a plan, plug in an employee's current balance, see this period's accrual + compliance issues."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Plan</h2>

            <Field label="Plan name">
              <input value={planName} onChange={(e) => setPlanName(e.target.value)} className={INPUT} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select value={planType} onChange={(e) => setPlanType(e.target.value as PtoPlan['type'])} className={INPUT}>
                  <option value="CA_SICK">CA sick leave</option>
                  <option value="VACATION">Vacation</option>
                  <option value="PTO_COMBINED">PTO combined</option>
                </select>
              </Field>
              <Field label="Accrual method">
                <select
                  value={accrualMethod}
                  onChange={(e) => setAccrualMethod(e.target.value as PtoPlan['accrualMethod'])}
                  className={INPUT}
                >
                  <option value="HOURLY">Hourly (per 30 h)</option>
                  <option value="FRONTLOAD">Frontload (yearly grant)</option>
                </select>
              </Field>
            </div>

            {accrualMethod === 'HOURLY' ? (
              <Field label="Accrual hours per 30 h worked (CA min: 1.0)">
                <input value={accrualPer30} onChange={(e) => setAccrualPer30(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            ) : (
              <Field label="Frontload hours per year (CA min: 40)">
                <input value={frontload} onChange={(e) => setFrontload(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Field label="Usable cap (CA min 40)">
                <input value={usableCap} onChange={(e) => setUsableCap(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Carryover cap (CA min 80)">
                <input value={carryoverCap} onChange={(e) => setCarryoverCap(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Eligibility days (CA max 90)">
                <input value={eligibilityDays} onChange={(e) => setEligibilityDays(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={payoutOnTerm} onChange={(e) => setPayoutOnTerm(e.target.checked)} />
              Pay out remaining balance at termination
            </label>

            {issues.length > 0 && (
              <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">CA compliance issues:</div>
                <ul className="mt-1 list-disc pl-5">
                  {issues.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Employee + period</h2>

            <Field label="Employee id (for context only)">
              <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hire date">
                <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={INPUT} />
              </Field>
              <Field label="As-of date">
                <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Balance (h)">
                <input value={balanceHours} onChange={(e) => setBalanceHours(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Used this year (h)">
                <input value={usedThisYear} onChange={(e) => setUsedThisYear(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Hours worked this period">
                <input value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Tile
                label="Eligible to use?"
                value={eligible ? 'Yes' : 'Not yet'}
              />
              <Tile
                label="Termination payout (h)"
                value={String(payoutHours)}
              />
              <Tile
                label="Accrual this period (h)"
                value={accruedThisPeriod ? String(accruedThisPeriod.delta) : '—'}
              />
              <Tile
                label="New balance (h)"
                value={accruedThisPeriod ? String(accruedThisPeriod.next.balanceHours) : (balance ? String(balance.balanceHours) : '—')}
              />
            </div>
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

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
