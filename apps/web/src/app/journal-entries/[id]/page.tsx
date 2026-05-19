// /journal-entries/[id] — one JE's detail + post/void controls.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell, PageHeader, Money } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import type { JournalEntry } from '@yge/shared';
import { JournalEntryStatusControls } from './journal-entry-status-controls';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEntry(id: string): Promise<JournalEntry | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/journal-entries/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { entry?: JournalEntry };
    return json.entry ?? null;
  } catch {
    return null;
  }
}

export default async function JournalEntryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('financials:view');
  const j = await fetchEntry(params.id);
  if (!j) notFound();

  const debitTotal = j.lines.reduce((s, l) => s + l.debitCents, 0);
  const creditTotal = j.lines.reduce((s, l) => s + l.creditCents, 0);
  const balanced = debitTotal === creditTotal && debitTotal > 0;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-4">
          <Link href="/journal-entries" className="text-sm text-yge-blue-500 hover:underline">
            ← All journal entries
          </Link>
        </div>
        <PageHeader
          title={`JE · ${j.entryDate}`}
          subtitle={j.memo}
        />

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <JournalEntryStatusControls
            id={j.id}
            initialStatus={j.status}
            balanced={balanced}
            postedAt={j.postedAt}
            voidedAt={j.voidedAt}
          />
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Header</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Row label="Entry date" value={j.entryDate} />
            <Row label="Source" value={j.source} />
            <Row label="Source ref" value={j.sourceRef ?? '—'} />
            <Row label="Posted at" value={j.postedAt?.slice(0, 16).replace('T', ' ') ?? '—'} />
            <Row label="Voided at" value={j.voidedAt?.slice(0, 16).replace('T', ' ') ?? '—'} />
            <Row label="Status" value={j.status} />
          </dl>
        </section>

        <section className="mb-4 rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
            Lines ({j.lines.length})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-left">Memo</th>
                <th className="px-3 py-2 text-left">Job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {j.lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs">{l.accountNumber}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.debitCents > 0 ? <Money cents={l.debitCents} /> : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.creditCents > 0 ? <Money cents={l.creditCents} /> : ''}
                  </td>
                  <td className="px-3 py-2 text-xs">{l.memo ?? ''}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.jobId ?? ''}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-right text-xs uppercase tracking-wide text-gray-500">Totals</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={debitTotal} /></td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={creditTotal} /></td>
                <td colSpan={2} className="px-3 py-2 text-xs">
                  {balanced ? (
                    <span className="text-green-700">Balanced ✓</span>
                  ) : (
                    <span className="text-red-700">
                      Out of balance by <Money cents={Math.abs(debitTotal - creditTotal)} />
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {j.notes && (
          <section className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Internal notes</h2>
            <p className="whitespace-pre-wrap text-xs text-gray-700">{j.notes}</p>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}
