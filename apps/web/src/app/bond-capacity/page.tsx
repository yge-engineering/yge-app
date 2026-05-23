'use client';

// /bond-capacity — surety bond capacity calculator.
//
// Brook (President) owns the bonding relationship. This page lets
// her see used vs. available aggregate capacity, project what a
// prospective bid would do to utilization, and compute the bond
// premium at the surety's rate.
//
// Pure client side using bundle 2506's helpers. Inputs: aggregate
// cap, single-job cap, bond rate (bps), CSV of bonded jobs +
// remaining contract $, prospective bid contract $.

import { useMemo, useState } from 'react';
import {
  BondedJobSchema,
  bondPremiumCents,
  exceedsSingleJobCap,
  projectBondCapacityWithBid,
  rollupBondCapacity,
  type BondedJob,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const SEED = `# Paste rows like: jobId, projectName, remainingContractCents
job-1, Sulphur Springs Soquol Rd, 200000000
job-2, Manton CSD Pipeline,        150000000
job-3, Whitmore Yard Expansion,     50000000`;

function parseJobs(text: string): { jobs: BondedJob[]; errors: string[] } {
  const jobs: BondedJob[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 3) {
        errors.push(`Line ${idx + 1}: need jobId, projectName, remainingContractCents`);
        return;
      }
      const [jobId, projectName, centsStr] = cols;
      const cents = Number(centsStr);
      if (!Number.isFinite(cents) || cents < 0) {
        errors.push(`Line ${idx + 1}: bad cents value "${centsStr}"`);
        return;
      }
      const parsed = BondedJobSchema.safeParse({
        jobId,
        projectName,
        remainingContractCents: Math.round(cents),
      });
      if (!parsed.success) {
        errors.push(`Line ${idx + 1}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
        return;
      }
      jobs.push(parsed.data);
    });
  return { jobs, errors };
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

export default function BondCapacityPage() {
  const [aggregateCapDollars, setAggregateCapDollars] = useState('10000000');
  const [singleJobCapDollars, setSingleJobCapDollars] = useState('5000000');
  const [bondRateBps, setBondRateBps] = useState('125');
  const [jobsCsv, setJobsCsv] = useState(SEED);
  const [prospectiveDollars, setProspectiveDollars] = useState('2500000');

  const { jobs, errors } = useMemo(() => parseJobs(jobsCsv), [jobsCsv]);
  const aggregateCents = Math.round(Number(aggregateCapDollars) * 100) || 0;
  const singleJobCents = Math.round(Number(singleJobCapDollars) * 100) || 0;
  const prospectiveCents = Math.round(Number(prospectiveDollars) * 100) || 0;
  const rateBps = Math.max(0, Number(bondRateBps) || 0);

  const rollup = useMemo(() => rollupBondCapacity(aggregateCents, jobs), [aggregateCents, jobs]);
  const projected = useMemo(
    () => projectBondCapacityWithBid(rollup, prospectiveCents),
    [rollup, prospectiveCents],
  );
  const tooBigForSingle = exceedsSingleJobCap(singleJobCents, prospectiveCents);
  const premium = bondPremiumCents(prospectiveCents, rateBps);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Bond capacity"
          subtitle="Aggregate + single-job caps from the surety, current bonded backlog, and what a prospective bid would do to utilization. Pure calculator — no persisted state."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Surety profile</h2>
            <Field label="Aggregate cap ($)">
              <input
                value={aggregateCapDollars}
                onChange={(e) => setAggregateCapDollars(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </Field>
            <Field label="Single-job cap ($)">
              <input
                value={singleJobCapDollars}
                onChange={(e) => setSingleJobCapDollars(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </Field>
            <Field label="Bond rate (basis points — 125 = 1.25%)">
              <input
                value={bondRateBps}
                onChange={(e) => setBondRateBps(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </Field>

            <h3 className="mt-6 text-sm font-semibold text-gray-700">
              Active bonded jobs (CSV)
            </h3>
            <p className="text-xs text-gray-500">
              jobId, projectName, remainingContractCents.
              Lines starting with # are ignored.
            </p>
            <textarea
              value={jobsCsv}
              onChange={(e) => setJobsCsv(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            {errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-red-700">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Current utilization</h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Tile label="Used" value={fmtMoney(rollup.usedCents)} />
              <Tile label="Available" value={fmtMoney(rollup.availableCents)} />
              <Tile label="Utilization" value={fmtPct(rollup.utilization)} />
            </div>
            {rollup.exceeded && (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                Backlog exceeds the aggregate cap. No new bonds will issue until earlier jobs close out.
              </p>
            )}

            <h3 className="mt-6 text-sm font-semibold text-gray-700">Prospective bid</h3>
            <Field label="Contract value ($)">
              <input
                value={prospectiveDollars}
                onChange={(e) => setProspectiveDollars(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </Field>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Tile label="New used" value={fmtMoney(projected.newUsedCents)} />
              <Tile label="New available" value={fmtMoney(projected.newAvailableCents)} />
              <Tile label="New utilization" value={fmtPct(projected.newUtilization)} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Tile label="Bond premium" value={fmtMoney(premium)} />
              <Tile
                label="Fits aggregate cap?"
                value={projected.fits ? 'Yes' : 'No'}
              />
            </div>

            {tooBigForSingle && (
              <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Project value exceeds the surety's single-job cap. Will need a new bonding line or partner.
              </p>
            )}
            {!projected.fits && aggregateCents > 0 && (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                Winning this bid would exceed the aggregate cap. Talk to the surety before submitting.
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
