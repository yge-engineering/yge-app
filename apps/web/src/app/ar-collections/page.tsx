// /ar-collections — Brook's Monday-morning collections view.
//
// Fetches every open AR invoice from the API, computes age + amount
// outstanding for each, and runs the new ar-collection-sequence rule
// engine to pick the recommended next action. Renders the ranked
// list (urgency desc, amount desc) so Brook works the top of the
// list first.

import Link from 'next/link';

import { AppShell, PageHeader, Alert } from '../../components';
import { ArCollectionsCsvButtons } from '../../components/ar-collections-csv-buttons';
import {
  rankArCollections,
  formatUSD,
  type ArInvoice,
  type ArCollectionAction,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ArInvoiceListResponse {
  invoices: ArInvoice[];
}

async function fetchOpenInvoices(): Promise<ArInvoice[]> {
  const res = await fetch(
    `${apiBaseUrl()}/api/ar-invoices?status=SENT`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  const json = (await res.json()) as ArInvoiceListResponse;
  return json.invoices;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days from an ISO date to today (today - date). Positive = past. */
function daysFromToday(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z').getTime();
  const t = new Date(todayIso() + 'T00:00:00Z').getTime();
  return Math.round((t - d) / (1000 * 60 * 60 * 24));
}

const ACTION_LABEL: Record<ArCollectionAction, string> = {
  NONE: '—',
  COURTESY_CALL: 'Courtesy call',
  EMAIL_REMINDER: 'Email reminder',
  PRELIMINARY_LIEN_NOTICE: '20-day notice (lien rights)',
  DEMAND_LETTER: 'Demand letter',
  STOP_PAYMENT_NOTICE: 'Stop-payment notice (§9350)',
  LEGAL_ESCALATION: 'Escalate to counsel',
};

const URGENCY_TONE: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-amber-100 text-amber-900',
  4: 'bg-orange-100 text-orange-900',
  5: 'bg-red-100 text-red-900',
};

export default async function ArCollectionsPage() {
  let invoices: ArInvoice[] = [];
  let fetchError: string | null = null;
  try {
    invoices = await fetchOpenInvoices();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'fetch failed';
  }

  // Only invoices with a due date can be aged. Skip drafts + paid.
  const eligible = invoices.filter((i) => i.dueDate && i.totalCents > i.paidCents);
  const ranked = rankArCollections(
    eligible.map((i) => ({
      amountCents: i.totalCents - i.paidCents,
      ageDays: daysFromToday(i.dueDate!),
    })),
  );

  // Match each ranked recommendation back to its invoice by index — the
  // rankArCollections call preserves the original objects, but here we
  // ranked plain pairs so we need a separate lookup.
  const rankedWithInvoice = ranked.map((row, idx) => ({
    rec: row.rec,
    invoice: eligible[idx]!,
    age: row.invoice.ageDays,
  }));
  // Sort by urgency desc, then amount desc, mirroring rankArCollections.
  rankedWithInvoice.sort((a, b) => {
    if (a.rec.urgency !== b.rec.urgency) return b.rec.urgency - a.rec.urgency;
    return b.rec.action.localeCompare(a.rec.action);
  });

  const totalOutstanding = eligible.reduce(
    (sum, i) => sum + (i.totalCents - i.paidCents),
    0,
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <PageHeader
          title="AR collections — morning view"
          subtitle="Brook's Monday list. Ranked by the AR collection-sequence rule engine — urgency first, then dollar amount. Work the top down."
        />

        {fetchError && (
          <Alert tone="danger" className="mt-4">
            Couldn&apos;t load AR invoices: {fetchError}
          </Alert>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Open invoices
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
              {eligible.length}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Outstanding
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
              {formatUSD(totalOutstanding, { compact: true })}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Need action today
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">
              {rankedWithInvoice.filter((r) => r.rec.urgency >= 4).length}
            </div>
            <div className="mt-1 text-xs text-gray-500">urgency ≥ 4</div>
          </div>
        </div>

        {rankedWithInvoice.length === 0 && !fetchError && (
          <p className="mt-6 rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No open invoices past their due date. Nice work.
          </p>
        )}

        {rankedWithInvoice.length > 0 && (
          <div className="mt-4 flex justify-end">
            <ArCollectionsCsvButtons
              rows={rankedWithInvoice.map(({ invoice, rec, age }) => ({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                customerName: invoice.customerName,
                amountOutstandingCents: invoice.totalCents - invoice.paidCents,
                ageDays: age,
                action: rec.action,
                actionLabel: ACTION_LABEL[rec.action],
                reason: rec.reason,
              }))}
            />
          </div>
        )}

        {rankedWithInvoice.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Customer / invoice</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Days past due</th>
                  <th className="px-4 py-2">Recommended action</th>
                  <th className="px-4 py-2">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankedWithInvoice.map(({ invoice, rec, age }) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/ar-invoices/${invoice.id}`}
                        className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
                      >
                        {invoice.customerName}
                      </Link>
                      <div className="text-xs text-gray-500">#{invoice.invoiceNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatUSD(invoice.totalCents - invoice.paidCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {age}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${URGENCY_TONE[rec.urgency] ?? URGENCY_TONE[1]}`}
                      >
                        {ACTION_LABEL[rec.action]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{rec.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
