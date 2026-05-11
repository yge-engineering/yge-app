// /portal/bond — bond agent / underwriter portal.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Money } from '../../../components/money';
import { getCurrentUser } from '../../../lib/auth';
import { currentUserCan } from '../../../lib/permissions';
import {
  buildBalanceSheet,
  type Account,
  type Job,
  type JournalEntry,
  type MasterProfile,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMasterProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { profile?: MasterProfile };
    return body.profile ?? null;
  } catch {
    return null;
  }
}

async function fetchAccounts(): Promise<Account[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/coa`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { accounts: Account[] }).accounts;
  } catch {
    return [];
  }
}
async function fetchJournalEntries(): Promise<JournalEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: JournalEntry[] }).entries;
  } catch {
    return [];
  }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch {
    return [];
  }
}

export default async function BondPortalPage() {
  if (!currentUserCan('portal:bond')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const [profile, jobs, accounts, entries] = await Promise.all([
    fetchMasterProfile(),
    fetchJobs(),
    fetchAccounts(),
    fetchJournalEntries(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const balanceSheet = buildBalanceSheet({
    accounts,
    entries,
    asOf: today,
  });
  const active = jobs.filter(
    (j) => j.status === 'AWARDED' || j.status === 'BID_SUBMITTED' || j.status === 'PURSUING',
  );
  const activeValueCents = active.reduce(
    (sum, j) => sum + (j.engineersEstimateCents ?? 0),
    0,
  );
  const bonding = profile?.bonding;
  const aggregateLimit = bonding?.aggregateLimitCents ?? 0;
  const usedRatio =
    aggregateLimit > 0 ? activeValueCents / aggregateLimit : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-yge-blue-900">
              Young General Engineering — bond agent portal
            </h1>
            <p className="text-xs text-gray-600">
              Welcome, {me?.name ?? me?.email ?? 'agent'}. Bonding capacity
              + active job summary.
            </p>
          </div>
          <Link
            href="/api/auth/logout"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Bonding capacity
          </h2>
          {bonding ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Surety</dt>
                <dd>{bonding.suretyName}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Agent</dt>
                <dd>{bonding.agentName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Single-job limit</dt>
                <dd className="font-mono">
                  <Money cents={bonding.singleJobLimitCents} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Aggregate limit</dt>
                <dd className="font-mono">
                  <Money cents={bonding.aggregateLimitCents} />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              Master profile bonding section not set up yet.
            </p>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Capacity utilization
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Active job value</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={activeValueCents} />
              </div>
              <div className="text-[11px] text-gray-500">
                {active.length} active job{active.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Aggregate limit</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={aggregateLimit} />
              </div>
            </div>
            <div
              className={`rounded border p-3 ${
                usedRatio >= 0.8
                  ? 'border-red-300 bg-red-50'
                  : usedRatio >= 0.5
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-green-300 bg-green-50'
              }`}
            >
              <div className="text-xs text-gray-700">% used</div>
              <div className="mt-1 font-mono text-lg font-bold">
                {aggregateLimit > 0
                  ? `${(usedRatio * 100).toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active jobs
          </h2>
          {active.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No active jobs.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {active.map((j) => (
                <li key={j.id} className="py-2 text-sm">
                  <a
                    href={`/portal/bond/jobs/${j.id}`}
                    className="font-semibold text-yge-blue-700 hover:underline"
                  >
                    {j.projectName}
                  </a>
                  {j.ownerAgency ? (
                    <span className="ml-2 text-xs text-gray-600">
                      ({j.ownerAgency})
                    </span>
                  ) : null}
                  <span className="ml-2 text-xs text-gray-500">{j.status}</span>
                  {j.engineersEstimateCents != null ? (
                    <span className="ml-2 font-mono text-xs text-gray-700">
                      <Money cents={j.engineersEstimateCents} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Completed jobs (this year)
          </h2>
          {(() => {
            const year = new Date().getFullYear();
            const closed = jobs.filter(
              (j) => j.status === 'ARCHIVED' || j.status === 'AWARDED',
            );
            // We don't store actualEnd on the file-store Job, so fall
            // back to updatedAt's year as a proxy.
            const thisYearClosed = closed.filter((j) =>
              j.updatedAt.startsWith(String(year)),
            );
            if (thisYearClosed.length === 0) {
              return (
                <p className="mt-2 text-sm text-gray-500">
                  No closed jobs yet this year.
                </p>
              );
            }
            return (
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {thisYearClosed.map((j) => (
                  <li key={j.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {j.projectName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {j.ownerAgency ?? '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold">
                        {j.engineersEstimateCents != null ? (
                          <Money cents={j.engineersEstimateCents} />
                        ) : (
                          '—'
                        )}
                      </span>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">
                        {j.status}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Latest financial summary (as of {today})
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Total assets</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={balanceSheet.assets.totalCents} />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total liabilities</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={balanceSheet.liabilities.totalCents} />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Equity + retained</div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money
                  cents={
                    balanceSheet.equity.totalCents +
                    balanceSheet.currentPeriodEarningsCents
                  }
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Auto-computed from the GL through today. Ask Brook for a
            CPA-prepared statement for credit-decision underwriting.
          </p>
        </section>

        <p className="text-[11px] text-gray-500">
          Active job value is the sum of engineer's estimates on jobs
          in PURSUING / BID_SUBMITTED / AWARDED status. For exposure
          based on actual contract amounts, ask Brook for the latest
          WIP.
        </p>
      </div>
    </main>
  );
}
