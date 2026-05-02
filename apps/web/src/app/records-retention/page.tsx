// /records-retention — rules table + summary.
//
// Server component listing every retention rule the engine codifies,
// the statutory authority, and the citation. The actual purge job +
// review-and-confirm UI build on top in subsequent commits; this is
// the operator-readable rules dashboard.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../components';
import { RetentionPurgeConfirmForm } from '../../components/retention-purge-confirm-form';
import { getTranslator } from '../../lib/locale';
import {
  RETENTION_RULES,
  computeRetentionStats,
  type RecordRetentionAuthority,
  type RetentionPurgeBatch,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface PurgeRow {
  entityType: string;
  entityId: string;
  label: string;
  triggerDateIso: string;
  purgeEligibleOn: string;
  frozen: boolean;
  frozenByHoldIds: string[];
  contextNote?: string;
}
interface PurgeReport {
  generatedAt: string;
  rulesEvaluated: number;
  eligibleCount: number;
  frozenCount: number;
  perEntity: Array<{
    entityType: string;
    rule: { label: string; retainYears: number; authority: string };
    rows: PurgeRow[];
  }>;
}

async function fetchPurgeReport(): Promise<PurgeReport | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/records-retention/purge-report`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { report: PurgeReport }).report;
  } catch { return null; }
}

async function fetchPurgeBatches(): Promise<RetentionPurgeBatch[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/records-retention/purge-batches`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { batches: RetentionPurgeBatch[] }).batches;
  } catch { return []; }
}

const AUTHORITY_TONE: Record<
  RecordRetentionAuthority,
  'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted'
> = {
  IRS: 'info',
  CA_LABOR_CODE: 'warn',
  CA_DIR: 'info',
  CAL_OSHA: 'danger',
  FEDERAL_OSHA: 'danger',
  FEDERAL_I9: 'warn',
  CA_DOI: 'info',
  CONTRACT_CONVENTION: 'neutral',
  YGE_INTERNAL: 'muted',
};

export default async function RecordsRetentionPage() {
  const stats = computeRetentionStats();
  const purgeReport = await fetchPurgeReport();
  const purgeBatches = await fetchPurgeBatches();
  const apiBase = apiBaseUrl();
  // Group by authority for the rules table.
  const sortedRules = [...RETENTION_RULES].sort((a, b) => {
    if (a.authority !== b.authority) return a.authority.localeCompare(b.authority);
    if (a.retainYears !== b.retainYears) return b.retainYears - a.retainYears;
    return a.label.localeCompare(b.label);
  });
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link href="/legal-holds" className="text-sm text-yge-blue-500 hover:underline">
            Legal holds &rarr;
          </Link>
        </div>

        <PageHeader
          title={t('recordsRetention.title')}
          subtitle={t('recordsRetention.subtitle')}
        />

        <Alert tone="info" className="mt-4">
          The purge job runs against each record's <em>trigger date</em>{' '}
          (CREATED_AT / JOB_FINAL_ACCEPTANCE / EMPLOYEE_SEPARATION / etc.) +
          the rule's retain-years window. Records frozen by an active hold
          on <Link href="/legal-holds" className="text-yge-blue-500 hover:underline">/legal-holds</Link>{' '}
          stay until the hold releases, regardless of the timer.
        </Alert>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label={t('recordsRetention.tile.rules')} value={String(stats.total)} />
          <Tile
            label={t('recordsRetention.tile.longest')}
            value={`${stats.longestRetainYears} yrs`}
            sub={stats.longestRule?.label}
          />
          <Tile
            label={t('recordsRetention.tile.authorities')}
            value={String(
              Object.values(stats.byAuthority).filter((c) => c > 0).length,
            )}
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('recordsRetention.col.authority')}</th>
                <th className="px-3 py-2 text-left">{t('recordsRetention.col.record')}</th>
                <th className="px-3 py-2 text-left">{t('recordsRetention.col.trigger')}</th>
                <th className="px-3 py-2 text-right">{t('recordsRetention.col.retain')}</th>
                <th className="px-3 py-2 text-left">{t('recordsRetention.col.citation')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRules.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 align-top">
                    <StatusPill
                      label={r.authority}
                      tone={AUTHORITY_TONE[r.authority]}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-gray-900">{r.label}</div>
                    <div className="font-mono text-[11px] text-gray-500">
                      {r.entityType}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-600">
                    {r.trigger.replace(/_/g, ' ').toLowerCase()}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-sm">
                    {r.retainYears} yr{r.retainYears === 1 ? '' : 's'}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-700">
                    {r.citation}
                    {r.note && (
                      <div className="mt-1 text-[11px] italic text-gray-500">
                        Note: {r.note}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {purgeReport && (
          <section className="mt-8">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                {t('recordsRetention.purge.title')}
              </h2>
              <span className="text-xs text-gray-500">
                Generated {purgeReport.generatedAt.replace('T', ' ').slice(0, 16)} · {purgeReport.rulesEvaluated} rules
              </span>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              <Tile label={t('recordsRetention.purge.eligible')} value={String(purgeReport.eligibleCount)} sub="not frozen by any active hold" />
              <Tile label={t('recordsRetention.purge.frozen')} value={String(purgeReport.frozenCount)} sub="purge blocked while hold is active" />
            </div>

            {purgeReport.perEntity.length === 0 ? (
              <Alert tone="success" className="mt-4">
                No records past their retention window today. The dry run
                ran across {purgeReport.rulesEvaluated} rules and found
                nothing eligible.
              </Alert>
            ) : (
              <div className="mt-4 space-y-4">
                {purgeReport.perEntity.map((bucket) => (
                  <section
                    key={bucket.entityType}
                    className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm"
                  >
                    <header className="bg-gray-50 px-3 py-2 text-xs">
                      <strong className="text-gray-900">
                        {bucket.entityType}
                      </strong>{' '}
                      · {bucket.rule.label} · {bucket.rule.retainYears}-year retention via {bucket.rule.authority}
                    </header>
                    <table className="w-full text-xs">
                      <thead className="bg-white text-[11px] uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-1 text-left">{t('recordsRetention.col.record')}</th>
                          <th className="px-3 py-1 text-left">{t('recordsRetention.col.trigger')}</th>
                          <th className="px-3 py-1 text-left">{t('recordsRetention.purge.col.eligibleOn')}</th>
                          <th className="px-3 py-1 text-left">{t('recordsRetention.purge.col.state')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bucket.rows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5">
                              <div className="text-gray-900">{r.label}</div>
                              <div className="font-mono text-[10px] text-gray-500">{r.entityId}</div>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">
                              {r.triggerDateIso.slice(0, 10)}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">
                              {r.purgeEligibleOn}
                            </td>
                            <td className="px-3 py-1.5">
                              {r.frozen ? (
                                <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] uppercase text-red-800">
                                  frozen ({r.frozenByHoldIds.length} hold{r.frozenByHoldIds.length === 1 ? '' : 's'})
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] uppercase text-emerald-800">
                                  eligible
                                </span>
                              )}
                              {r.contextNote && (
                                <span className="ml-2 text-gray-500">{r.contextNote}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <RetentionPurgeConfirmForm
                      apiBaseUrl={apiBase}
                      entityType={bucket.entityType}
                      bucketLabel={bucket.rule.label}
                      ruleAuthority={bucket.rule.authority}
                      retainYears={bucket.rule.retainYears}
                      rows={bucket.rows.map((r) => ({
                        entityId: r.entityId,
                        label: r.label,
                        purgeEligibleOn: r.purgeEligibleOn,
                        frozen: r.frozen,
                      }))}
                    />
                  </section>
                ))}
              </div>
            )}
          </section>
        )}

        {purgeBatches.length > 0 && (
          <section className="mt-8">
            <header className="mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                {t('recordsRetention.batches.title')}
              </h2>
              <p className="text-xs text-gray-500">
                Operator-confirmed retention destruction decisions, newest
                first. Each batch links to per-row audit entries (one
                <code className="mx-1 rounded bg-gray-100 px-1 font-mono text-[10px]">purge</code>
                event per record). Phase 1 records the decision; per-store
                byte-deletion ships next.
              </p>
            </header>
            <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('recordsRetention.batches.col.batch')}</th>
                    <th className="px-3 py-2 text-left">{t('recordsRetention.batches.col.bucket')}</th>
                    <th className="px-3 py-2 text-left">{t('recordsRetention.col.authority')}</th>
                    <th className="px-3 py-2 text-right">{t('recordsRetention.batches.col.rows')}</th>
                    <th className="px-3 py-2 text-left">{t('recordsRetention.batches.col.reason')}</th>
                    <th className="px-3 py-2 text-left">{t('recordsRetention.batches.col.when')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purgeBatches.slice(0, 25).map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 align-top font-mono text-[11px] text-gray-700">
                        {b.id}
                        {!b.bytesDeleted && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                            decision-only
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-gray-900">{b.ruleLabel}</div>
                        <div className="font-mono text-[10px] text-gray-500">{b.entityType}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusPill label={b.ruleAuthority} tone="info" size="sm" />
                        <div className="mt-0.5 text-[10px] text-gray-500">{b.retainYears}-yr</div>
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">{b.rows.length}</td>
                      <td className="px-3 py-2 align-top text-gray-700">{b.operatorReason}</td>
                      <td className="px-3 py-2 align-top font-mono text-[11px] text-gray-600">
                        {b.createdAt.replace('T', ' ').slice(0, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="mt-8 text-xs text-gray-500">
          The dry-run report above is read-only — actual purging requires
          per-bucket operator confirmation that ships next. When in doubt
          YGE policy extends rather than truncates: every rule either
          matches the statutory minimum or runs longer to cover audit-
          window / claim-window padding.
        </p>
      </main>
    </AppShell>
  );
}

function Tile({
  label, value, sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs italic text-gray-600">{sub}</div>}
    </div>
  );
}
