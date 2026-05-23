'use client';

// /dot-pool — FMCSA Part 382 random drug + alcohol testing pool.
//
// Plain English: 49 CFR §382.305 requires a CDL employer to randomly
// select 50% of avg driver positions for drug tests and 10% for
// alcohol tests, each year, spread across at least quarterly
// selection rounds. The selection has to be random (seeded), the
// record has to be reproducible, and inactive drivers are excluded
// but go back into the pool after testing.
//
// This page pulls active CDL holders from the employee roster,
// computes the annual + quarterly targets, lets the dispatcher seed
// + run a selection round, and prints the result for the audit
// binder.

import { useEffect, useMemo, useState } from 'react';
import {
  CertificationKind,
  Employee,
  computeAnnualTargets,
  hashSeed,
  mulberry32,
  quarterlyTargetPerPeriod,
  selectRandomPool,
  type DotDriver,
  type DotTestType,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const CDL_KINDS: CertificationKind[] = ['CDL_A', 'CDL_B'];

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function employeeIsActiveCdl(e: Employee, asOfDate: string): boolean {
  if (e.status !== 'ACTIVE') return false;
  return e.certifications.some((c) => {
    if (!CDL_KINDS.includes(c.kind)) return false;
    if (!c.expiresOn) return true; // lifetime
    return c.expiresOn >= asOfDate;
  });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultSeed(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}Q${q}-DRUG`;
}

export default function DotPoolPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [asOf, setAsOf] = useState(todayIso);
  const [seed, setSeed] = useState<string>(defaultSeed);
  const [testType, setTestType] = useState<DotTestType>('DRUG');
  const [count, setCount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees: Employee[] }) => setEmployees(j.employees ?? []))
      .catch(() => setEmployees([]));
  }, []);

  const roster: DotDriver[] = useMemo(
    () =>
      employees
        .filter((e) => employeeIsActiveCdl(e, asOf))
        .map((e) => ({
          id: e.id,
          name: `${e.lastName}, ${e.displayName ?? e.firstName}`,
          active: true,
        })),
    [employees, asOf],
  );

  const annual = useMemo(() => computeAnnualTargets(roster.length), [roster.length]);
  const drugQuarterly = quarterlyTargetPerPeriod(annual.drugTests);
  const alcoholQuarterly = quarterlyTargetPerPeriod(annual.alcoholTests);

  function runSelection() {
    setError(null);
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter how many drivers to select this round.');
      return;
    }
    if (n > roster.length) {
      setError(`Only ${roster.length} active CDL drivers — can't select ${n}.`);
      return;
    }
    try {
      const rng = mulberry32(hashSeed(seed.trim()));
      const r = selectRandomPool(roster, { testType, selectCount: n, rng });
      setSelectedIds(r.selectedDriverIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selection failed');
    }
  }

  const selectedRoster = selectedIds
    .map((id) => roster.find((d) => d.id === id))
    .filter((d): d is DotDriver => d !== undefined);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="DOT random testing pool"
          subtitle="49 CFR §382.305 — 50 % drug / 10 % alcohol of average CDL driver positions per year, spread across quarterly rounds. Selection seeded so the audit-binder copy reproduces."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Active CDL drivers" value={String(roster.length)} />
          <Tile label="Drug tests / year (50 %)" value={String(annual.drugTests)} />
          <Tile label="Alcohol tests / year (10 %)" value={String(annual.alcoholTests)} />
          <Tile label="This quarter (drug / alcohol)" value={`${drugQuarterly} / ${alcoholQuarterly}`} />
        </div>

        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Run a selection round</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Field label="As of">
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Test type">
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as DotTestType)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="DRUG">Drug</option>
                <option value="ALCOHOL">Alcohol</option>
              </select>
            </Field>
            <Field label="How many to select">
              <input
                type="number"
                min={1}
                step={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder={testType === 'DRUG' ? String(drugQuarterly) : String(alcoholQuarterly)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Seed (becomes audit-binder reference)">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </Field>
          </div>
          {error && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={runSelection}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
            >
              Run selection
            </button>
          </div>

          {selectedRoster.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900">
                Selected drivers ({selectedRoster.length}) — {testType.toLowerCase()} test
              </h3>
              <p className="mt-1 text-xs text-gray-500">Seed: {seed}</p>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2">#</th>
                    <th className="py-2">Driver</th>
                    <th className="py-2">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRoster.map((d, i) => (
                    <tr key={d.id} className="border-t border-gray-200">
                      <td className="py-2 font-mono text-gray-500">{i + 1}</td>
                      <td className="py-2 font-medium text-gray-900">{d.name}</td>
                      <td className="py-2 font-mono text-xs text-gray-500">{d.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">CDL roster</h2>
          {roster.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              No active CDL drivers found. Add CDL_A or CDL_B certifications on the employee record (with an expiration date after today) and they'll appear here.
            </p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2">Driver</th>
                  <th className="py-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((d) => (
                  <tr key={d.id} className="border-t border-gray-200">
                    <td className="py-2 font-medium text-gray-900">{d.name}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{d.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
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
