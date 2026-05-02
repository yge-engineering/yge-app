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
import {
  RETENTION_RULES,
  computeRetentionStats,
  type RecordRetentionAuthority,
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
  // Group by authority for the rules table.
  const sortedRules = [...RETENTION_RULES].sort((a, b) => {
    if (a.authority !== b.authority) return a.authority.localeCompare(b.authority);
    if (a.retainYears !== b.retainYears) return b.retainYears - a.retainYears;
    return a.label.localeCompare(b.label);
  });

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
          title="Records retention"
          subtitle="Statutory + regulatory rules the records-retention engine enforces. Every record carries a retention clock; legal holds freeze the clock until released."
        />

        <Alert tone="info" className="mt-4">
          The purge job runs against each record's <em>trigger date</em>{' '}
          (CREATED_AT / JOB_FINAL_ACCEPTANCE / EMPLOYEE_SEPARATION / etc.) +
          the rule's retain-years window. Records frozen by an active hold
          on <Link href="/legal-holds" className="text-yge-blue-500 hover:underline">/legal-holds</Link>{' '}
          stay until the hold releases, regardless of the timer.
        </Alert>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Rules in engine" value={String(stats.total)} />
          <Tile
            label="Longest retention"
            value={`${stats.longestRetainYears} yrs`}
            sub={stats.longestRule?.label}
          />
          <Tile
            label="Authorities"
            value={String(
              Object.values(stats.byAuthority).filter((c) => c > 0).length,
            )}
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Authority</th>
                <th className="px-3 py-2 text-left">Record</th>
                <th className="px-3 py-2 text-left">Trigger</th>
                <th className="px-3 py-2 text-right">Retain</th>
                <th className="px-3 py-2 text-left">Citation</th>
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
                Purge eligibility (dry run)
              </h2>
              <span className="text-xs text-gray-500">
                Generated {purgeReport.generatedAt.replace('T', ' ').slice(0, 16)} · {purgeReport.rulesEvaluated} rules
              </span>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              <Tile label="Eligible to purge" value={String(purgeReport.eligibleCount)} sub="not frozen by any active hold" />
              <Tile label="Frozen by legal hold" value={String(purgeReport.frozenCount)} sub="purge blocked while hold is active" />
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
                          <th className="px-3 py-1 text-left">Record</th>
                          <th className="px-3 py-1 text-left">Trigger</th>
                          <th className="px-3 py-1 text-left">Eligible on</th>
                          <th className="px-3 py-1 text-left">State</th>
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
                  </section>
                ))}
              </div>
            )}
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
