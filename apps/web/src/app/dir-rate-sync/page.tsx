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
import { DirProposalDecisionButtons } from '@/components/dir-proposal-decision-buttons';
import { DirRateManualImportForm } from '@/components/dir-rate-manual-import-form';
import {
  type DirRateProposal,
  type DirRateProposalDiff,
  type DirRateProposalStatus,
  type DirRateSyncRun,
} from '@yge/shared';
import { getTranslator } from '../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dir-rates" className="text-sm text-yge-blue-500 hover:underline">
            {t('drs.backLink')}
          </Link>
          <span className="text-xs text-gray-500">
            {t('drs.headerCount', { pending: pending.length, reviewed: proposals.length - pending.length })}
          </span>
        </div>

        <PageHeader
          title={t('drs.title')}
          subtitle={t('drs.subtitle')}
        />

        {significant.length > 0 && (
          <Alert
            tone="warn"
            className="mt-4"
            title={t('drs.alert.significant.title', { count: significant.length, plural: significant.length === 1 ? '' : 's' })}
          >
            {t('drs.alert.significant.body')}
          </Alert>
        )}

        {proposals.length === 0 && (
          <Alert tone="info" className="mt-6">
            {t('drs.alert.empty')}
          </Alert>
        )}

        {proposals.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('drs.col.status')}</th>
                  <th className="px-3 py-2 text-left">{t('drs.col.classification')}</th>
                  <th className="px-3 py-2 text-left">{t('drs.col.effective')}</th>
                  <th className="px-3 py-2 text-right">{t('drs.col.deltaBasic')}</th>
                  <th className="px-3 py-2 text-right">{t('drs.col.deltaFringe')}</th>
                  <th className="px-3 py-2 text-right">{t('drs.col.deltaTotal')}</th>
                  <th className="px-3 py-2 text-left">{t('drs.col.note')}</th>
                  <th className="px-3 py-2 text-right">{t('drs.col.review')}</th>
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
                            {t('drs.badge.new')}
                          </span>
                        )}
                        {p.diff.significantWageMove && p.status === 'PENDING' && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                            {t('drs.badge.significant')}
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
                      <td className="px-3 py-2 text-right">
                        <DirProposalDecisionButtons
                          apiBaseUrl={publicApiBaseUrl()}
                          proposalId={p.id}
                          disabled={p.status !== 'PENDING'}
                        />
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
            {t('drs.recentRuns')}
          </h2>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-500">{t('drs.noRuns')}</p>
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
                    {t('drs.runStats', { created: r.proposalsCreated, plural: r.proposalsCreated === 1 ? '' : 's', scraped: r.classificationsScraped })}
                    {r.classificationsFailed > 0 && (
                      <span className="ml-1 text-red-700">
                        {t('drs.runFailed', { count: r.classificationsFailed })}
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

        <DirRateManualImportForm apiBaseUrl={publicApiBaseUrl()} />

        <p className="mt-8 text-xs text-gray-500">{t('drs.footer')}</p>
      </main>
    </AppShell>
  );
}
