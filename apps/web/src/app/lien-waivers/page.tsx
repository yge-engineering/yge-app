// /lien-waivers — CA statutory waiver tracker.

import Link from 'next/link';
import {
  computeLienWaiverRollup,
  formatUSD,
  isConditional,
  lienWaiverShortKindLabel,
  lienWaiverStatusLabel,
  lienWaiverStatuteLabel,
  type LienWaiver,
  type LienWaiverStatus,
} from '@yge/shared';

const STATUSES: LienWaiverStatus[] = ['DRAFT', 'SIGNED', 'DELIVERED', 'VOIDED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchWaivers(filter: { status?: string; jobId?: string }): Promise<LienWaiver[]> {
  const url = new URL(`${apiBaseUrl()}/api/lien-waivers`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { waivers: LienWaiver[] }).waivers;
}
async function fetchAll(): Promise<LienWaiver[]> {
  const res = await fetch(`${apiBaseUrl()}/api/lien-waivers`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { waivers: LienWaiver[] }).waivers;
}

export default async function LienWaiversPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [waivers, all] = await Promise.all([fetchWaivers(searchParams), fetchAll()]);
  const rollup = computeLienWaiverRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/lien-waivers?${q}` : '/lien-waivers';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/lien-waivers/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New waiver
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Lien Waivers</h1>
      <p className="mt-2 text-gray-700">
        CA Civil Code statutory waivers — §8132/§8134 progress + §8136/§8138 final.
        Conditional waivers are safe to hand over before payment clears; unconditional
        waivers must wait until funds clear.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Draft" value={rollup.draft} />
        <Stat label="Signed" value={rollup.signed} />
        <Stat
          label="Unsigned uncond. (caution)"
          value={rollup.unsignedUnconditional}
          variant={rollup.unsignedUnconditional > 0 ? 'warn' : 'ok'}
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
            {lienWaiverStatusLabel(s)}
          </Link>
        ))}
      </section>

      {waivers.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No lien waivers yet. Click <em>New waiver</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Through</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {waivers.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3 text-xs text-gray-700">{w.throughDate}</td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                        isConditional(w.kind)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {lienWaiverShortKindLabel(w.kind)}
                    </span>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {lienWaiverStatuteLabel(w.kind)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{w.ownerName}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{w.jobName}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {formatUSD(w.paymentAmountCents)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700">
                      {lienWaiverStatusLabel(w.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/lien-waivers/${w.id}`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                    {' · '}
                    <Link
                      href={`/lien-waivers/${w.id}/print`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Print
                    </Link>
                  </td>
                </tr>
              ))}
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
