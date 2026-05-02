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

export default function RecordsRetentionPage() {
  const stats = computeRetentionStats();
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

        <p className="mt-8 text-xs text-gray-500">
          The scheduled purge job + the review-and-confirm UI build on top
          of these rules in subsequent commits. When in doubt YGE policy
          extends rather than truncates — every rule above either matches
          the statutory minimum or runs longer to cover audit-window /
          claim-window padding.
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
