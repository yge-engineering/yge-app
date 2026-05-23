'use client';

// /year-end-checklist — derived year-end close status.
//
// Wires bundle 2516's buildYearEndChecklist into a real office tool.
// Enter the company's current state (counts of unposted AP, last
// bank-rec date, etc.) and see each of the 12 close steps marked
// TODO / IN_PROGRESS / DONE / BLOCKED with a plain-English next
// action. progressPct + open-step rollup at the top.

import { useMemo, useState } from 'react';

import {
  YearEndStateInputSchema,
  buildYearEndChecklist,
  openSteps,
  progressPct,
  type YearEndStateInput,
  type YearEndStepStatus,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

const TONE: Record<YearEndStepStatus, string> = {
  DONE: 'bg-green-100 text-green-900',
  IN_PROGRESS: 'bg-blue-100 text-blue-900',
  TODO: 'bg-gray-100 text-gray-700',
  BLOCKED: 'bg-amber-100 text-amber-900',
};

function defaultYearEnd(): string {
  // We close LAST calendar year through April 15 of the new year.
  const d = new Date();
  const y = d.getMonth() < 4 ? d.getFullYear() - 1 : d.getFullYear();
  return `${y}-12-31`;
}

export default function YearEndChecklistPage() {
  const [yearEndDate, setYearEndDate] = useState(defaultYearEnd);
  const [apUnposted, setApUnposted] = useState('0');
  const [arUnposted, setArUnposted] = useState('0');
  const [lastBankRec, setLastBankRec] = useState('');
  const [payrollReconciled, setPayrollReconciled] = useState(false);
  const [cprMissingWeeks, setCprMissingWeeks] = useState('0');
  const [tax1099Reviewed, setTax1099Reviewed] = useState(false);
  const [fixedAssetsUpdated, setFixedAssetsUpdated] = useState(false);
  const [depreciationPosted, setDepreciationPosted] = useState(false);
  const [wipFrozen, setWipFrozen] = useState(false);
  const [wcAuditExported, setWcAuditExported] = useState(false);
  const [taxCpaPackageSent, setTaxCpaPackageSent] = useState(false);
  const [booksLocked, setBooksLocked] = useState(false);

  const steps = useMemo(() => {
    const raw: Record<string, unknown> = {
      yearEndDate,
      apUnpostedCount: Math.max(0, Number(apUnposted) || 0),
      arUnpostedCount: Math.max(0, Number(arUnposted) || 0),
      lastBankRecDate: lastBankRec || null,
      payrollReconciled,
      cprMissingWeeks: Math.max(0, Number(cprMissingWeeks) || 0),
      tax1099Reviewed,
      fixedAssetsUpdated,
      depreciationPosted,
      wipFrozen,
      wcAuditExported,
      taxCpaPackageSent,
      booksLocked,
    };
    const parsed = YearEndStateInputSchema.safeParse(raw);
    return parsed.success ? buildYearEndChecklist(parsed.data as YearEndStateInput) : [];
  }, [
    yearEndDate,
    apUnposted,
    arUnposted,
    lastBankRec,
    payrollReconciled,
    cprMissingWeeks,
    tax1099Reviewed,
    fixedAssetsUpdated,
    depreciationPosted,
    wipFrozen,
    wcAuditExported,
    taxCpaPackageSent,
    booksLocked,
  ]);

  const pct = progressPct(steps);
  const open = openSteps(steps);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Year-end close checklist"
          subtitle="Plug in the company's current state — counts of unposted invoices, last bank-rec date, etc. — and see each of the 12 close steps with its next action. Gating logic: depreciation needs fixed-assets; CPA package needs everything else; books-lock needs CPA done."
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <Tile label="Year-end" value={yearEndDate} />
          <Tile label="Progress" value={`${Math.round(pct * 100)}%`} />
          <Tile label="Open steps" value={String(open.length)} />
          <Tile label="Blocked" value={String(steps.filter((s) => s.status === 'BLOCKED').length)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Current state</h2>

            <Field label="Year-end date">
              <input
                type="date"
                value={yearEndDate}
                onChange={(e) => setYearEndDate(e.target.value)}
                className={INPUT}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="AP unposted (count)">
                <input value={apUnposted} onChange={(e) => setApUnposted(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="AR unposted (count)">
                <input value={arUnposted} onChange={(e) => setArUnposted(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>
            <Field label="Last bank rec (yyyy-mm-dd, blank = none)">
              <input type="date" value={lastBankRec} onChange={(e) => setLastBankRec(e.target.value)} className={INPUT} />
            </Field>
            <Field label="CPR weeks still missing">
              <input value={cprMissingWeeks} onChange={(e) => setCprMissingWeeks(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>

            <h3 className="mt-6 text-sm font-semibold text-gray-700">Done?</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Check label="Payroll reconciled" value={payrollReconciled} onChange={setPayrollReconciled} />
              <Check label="1099 worksheets reviewed" value={tax1099Reviewed} onChange={setTax1099Reviewed} />
              <Check label="Fixed assets updated" value={fixedAssetsUpdated} onChange={setFixedAssetsUpdated} />
              <Check label="Depreciation posted" value={depreciationPosted} onChange={setDepreciationPosted} />
              <Check label="WIP frozen + signed" value={wipFrozen} onChange={setWipFrozen} />
              <Check label="WC audit exported" value={wcAuditExported} onChange={setWcAuditExported} />
              <Check label="Tax CPA package sent" value={taxCpaPackageSent} onChange={setTaxCpaPackageSent} />
              <Check label="Books locked" value={booksLocked} onChange={setBooksLocked} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">12 steps</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {steps.map((s) => (
                <li key={s.kind} className="rounded border border-gray-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-gray-900">
                      <span className="mr-2 font-mono text-xs text-gray-500">{String(s.order).padStart(2, '0')}.</span>
                      {s.title}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TONE[s.status]}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-700">{s.nextAction}</p>
                </li>
              ))}
            </ol>
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

function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}
