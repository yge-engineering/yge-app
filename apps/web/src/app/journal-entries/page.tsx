// /journal-entries — GL posting list.

import Link from 'next/link';
import {
  computeJournalEntryRollup,
  formatUSD,
  isBalanced,
  journalEntrySourceLabel,
  journalEntryStatusLabel,
  totalDebitCents,
  type JournalEntry,
  type JournalEntryStatus,
} from '@yge/shared';

const STATUSES: JournalEntryStatus[] = ['DRAFT', 'POSTED', 'VOIDED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEntries(filter: { status?: string }): Promise<JournalEntry[]> {
  const url = new URL(`${apiBaseUrl()}/api/journal-entries`);
  if (filter.status) url.searchParams.set('status', filter.status);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: JournalEntry[] }).entries;
}
async function fetchAll(): Promise<JournalEntry[]> {
  const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: JournalEntry[] }).entries;
}

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const [entries, all] = await Promise.all([fetchEntries(searchParams), fetchAll()]);
  const rollup = computeJournalEntryRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/journal-entries?${q}` : '/journal-entries';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/trial-balance"
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Trial balance
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Journal Entries</h1>
      <p className="mt-2 text-gray-700">
        General ledger postings. Every AR / AP / payroll / receipt eventually
        auto-posts a JE here. Hard rule: every entry must balance — sum of
        debits equals sum of credits to the cent.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total entries" value={rollup.total} />
        <Stat label="Posted" value={rollup.posted} />
        <Stat
          label="Draft"
          value={rollup.draft}
          variant={rollup.draft > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Posted $"
          value={formatUSD(rollup.postedDebitCents)}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
        <Link
          href={buildHref({ status: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {journalEntryStatusLabel(s)}
          </Link>
        ))}
      </section>

      {entries.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No journal entries yet. Phase 2 will auto-post these from AR / AP /
          payroll. For now, the API accepts manual JEs at{' '}
          <code className="rounded bg-gray-100 px-1">POST /api/journal-entries</code>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Memo</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Lines</th>
                <th className="px-4 py-2 text-right">Total $</th>
                <th className="px-4 py-2">Balanced?</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((j) => {
                const balanced = isBalanced(j);
                return (
                  <tr key={j.id} className={balanced ? '' : 'bg-red-50'}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {j.entryDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="line-clamp-1">{j.memo}</div>
                      {j.sourceRef && (
                        <div className="text-[10px] font-mono text-gray-500">
                          {j.sourceRef}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {journalEntrySourceLabel(j.source)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">{j.lines.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(totalDebitCents(j))}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {balanced ? (
                        <span className="text-green-700">✓</span>
                      ) : (
                        <span className="font-bold text-red-700">OUT OF BALANCE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                          j.status === 'POSTED'
                            ? 'bg-green-100 text-green-800'
                            : j.status === 'VOIDED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {journalEntryStatusLabel(j.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
