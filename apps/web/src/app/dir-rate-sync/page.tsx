// /dir-rate-sync — review staged DIR rate proposals.
//
// Staging area between DIR's website and the live rates that drive
// payroll + bid pricing + CPRs. The list shows pending proposals
// first with the wage-delta side-by-side; accept rolls the change
// into the live rate set, reject keeps the existing live rate
// untouched. Every accept / reject is audit-logged with the
// reviewer + reason.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../components';
import {
  type DirRateProposal,
  type DirRateProposalDiff,
  type DirRateProposalStatus,
  type DirRateSyncRun,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ProposalRow extends DirRateProposal {
  diff: DirRateProposalDiff;
}

interface ProposalsResponse {
  proposals: ProposalRow[];
}

interface RunsResponse {
  runs: DirRateSyncRun[];
}

async function fetchProposals(): Promise<ProposalRow[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dir-rate-sync/proposals`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ProposalsResponse).proposals;
  } catch { return []; }
}

async function fetchRuns(): Promise<DirRateSyncRun[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dir-rate-sync/runs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as RunsResponse).runs;
  } catch { return []; }
}

const STATUS_TONE: Record<DirRateProposalStatus, 'success' | 'warn' | 'danger' | 'muted' | 'neutral'> = {
  PENDING: 'warn',
  ACCEPTED: 'success',
  REJECTED: 'muted',
  STALE: 'muted',
};

function fmtCents(cents: number): string {
  const sign = cents < 0 ? '-' : cents > 0 ? '+' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default async function DirRateSyncPage() {
  const [proposals, runs] = await Promise.all([fetchProposals(), fetchRuns()]);

  const pending = proposals.filter((p) => p.status === 'PENDING');
  const significant = pending.filter((p) => p.diff.significantWageMove);
  const recent = runs.slice(0, 5);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dir-rates" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Live DIR rates
          </Link>
          <span className="text-xs text-gray-500">
            {pending.length} pending · {proposals.length - pending.length} reviewed
          </span>
        </div>

        <PageHeader
          title="DIR rate proposals"
          subtitle="Staged updates from the DIR website. Accept rolls a proposal into the live rate set; reject keeps the existing rate untouched. Every decision is audit-logged."
        />

        {significant.length > 0 && (
          <Alert
            tone="warn"
            className="mt-4"
            title={`${significant.length} proposal${significant.length === 1 ? '' : 's'} with a significant wage move`}
          >
            These move the total prevailing wage by more than 25¢/hr. Review
            carefully before accepting — every open bid and CPR rebases
            against the new rates the moment the proposal is accepted.
          </Alert>
        )}

        {proposals.length === 0 && (
          <Alert tone="info" className="mt-6">
            No proposals staged yet. The scheduled scrape lands new
            determinations here when DIR publishes its next semi-annual
            issue. PDF imports + manual sync can drop in the meantime.
          </Alert>
        )}

        {proposals.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Classification · County</th>
                  <th className="px-3 py-2 text-left">Effective</th>
                  <th className="px-3 py-2 text-right">Δ basic</th>
                  <th className="px-3 py-2 text-right">Δ fringe</th>
                  <th className="px-3 py-2 text-right">Δ total</th>
                  <th className="px-3 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proposals.map((p) => {
                  const fringeDelta =
                    p.diff.cents.healthAndWelfareCents +
                    p.diff.cents.pensionCents +
                    p.diff.cents.vacationHolidayCents +
                    p.diff.cents.trainingCents +
                    p.diff.cents.otherFringeCents;
                  return (
                    <tr key={p.id} className={p.status === 'PENDING' ? '' : 'opacity-70'}>
                      <td className="px-3 py-2">
                        <StatusPill label={p.status} tone={STATUS_TONE[p.status]} size="sm" />
                        {p.diff.kind === 'new' && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-800">
                            new
                          </span>
                        )}
                        {p.diff.significantWageMove && p.status === 'PENDING' && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                            significant
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className="font-medium text-gray-900">{p.classification}</span>
                        <span className="text-gray-500"> · {p.county}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-700">
                        {p.proposedRate.effectiveDate}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${p.diff.cents.basicHourlyCents > 0 ? 'text-emerald-700' : p.diff.cents.basicHourlyCents < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                        {fmtCents(p.diff.cents.basicHourlyCents)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${fringeDelta > 0 ? 'text-emerald-700' : fringeDelta < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                        {fmtCents(fringeDelta)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${p.diff.cents.totalPrevailingWageCents > 0 ? 'text-emerald-700' : p.diff.cents.totalPrevailingWageCents < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                        {fmtCents(p.diff.cents.totalPrevailingWageCents)}
                      </td>
                      <td className="px-3 py-2 text-xs italic text-gray-600">
                        {p.reviewNote ?? p.rationale ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent sync runs
          </h2>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-500">No sync runs yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <StatusPill label={r.status} tone={r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'danger' : r.status === 'PARTIAL' ? 'warn' : 'neutral'} size="sm" />
                  <time className="font-mono text-xs text-gray-500">
                    {(r.finishedAt ?? r.startedAt ?? r.createdAt).replace('T', ' ').slice(0, 16)}
                  </time>
                  <span className="text-xs uppercase tracking-wide text-gray-500">{r.source}</span>
                  <span className="text-sm text-gray-700">
                    {r.proposalsCreated} proposal{r.proposalsCreated === 1 ? '' : 's'} ·
                    {' '}{r.classificationsScraped} scraped
                    {r.classificationsFailed > 0 && (
                      <span className="ml-1 text-red-700">
                        / {r.classificationsFailed} failed
                      </span>
                    )}
                  </span>
                  {r.summary && (
                    <span className="ml-2 text-xs italic text-gray-600">"{r.summary}"</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-xs text-gray-500">
          Phase-1 review surface is read-only here. Accept / reject controls
          land in the next bundle along with the scheduled-scrape worker.
          The data model + persistence + diff math is in place; the
          API at <code>/api/dir-rate-sync</code> handles writes today.
        </p>
      </main>
    </AppShell>
  );
}
