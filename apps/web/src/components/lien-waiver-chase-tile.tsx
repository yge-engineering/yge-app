import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — lien-waiver chase summary.
//
// Plain English: every AR payment we receive needs a signed
// unconditional lien waiver before we file it away. Track which
// payments are missing one.

import Link from 'next/link';
import { buildLienWaiverChase, type ArPayment, type LienWaiver } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

async function LienWaiverChaseTileInner() {
  const [arPayments, lienWaivers] = await Promise.all([
    fetchJson<ArPayment>('/api/ar-payments', 'payments'),
    fetchJson<LienWaiver>('/api/lien-waivers', 'waivers'),
  ]);

  const { rows, rollup } = buildLienWaiverChase({
    arPayments,
    lienWaivers,
    asOf: new Date().toISOString().slice(0, 10),
  });

  if (rollup.total === 0) return null;

  const overdue = rows.filter((r) => r.daysSincePayment > 30).length;
  const tone =
    overdue > 0
      ? 'border-red-300 bg-red-50'
      : rollup.total > 0
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Lien-waiver chase
          </h2>
          <p className="text-xs text-gray-600">
            {overdue > 0
              ? `⚠︎ ${overdue} payment${overdue === 1 ? '' : 's'} > 30 days old still missing an unconditional waiver.`
              : `${rollup.total} AR payment${rollup.total === 1 ? '' : 's'} need waiver follow-up.`}
          </p>
        </div>
        <Link
          href="/lien-waivers"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Open list →
        </Link>
      </header>
      <dl className="mt-3 grid grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            No waiver
          </dt>
          <dd className={`font-mono text-base font-semibold ${rollup.noWaiver > 0 ? 'text-red-700' : 'text-gray-800'}`}>
            {rollup.noWaiver}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Draft
          </dt>
          <dd className="font-mono text-base font-semibold text-amber-700">
            {rollup.draft}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Signed, not delivered
          </dt>
          <dd className="font-mono text-base font-semibold text-amber-700">
            {rollup.signedNotDelivered}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Need unconditional
          </dt>
          <dd className="font-mono text-base font-semibold text-amber-700">
            {rollup.conditionalNeedsUnconditional}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Resilient wrapper — if anything throws inside LienWaiverChaseTileInner (bad
// data shape, API timeout, builder bug), we render null instead of
// crashing the dashboard. Errors get logged server-side.
export async function LienWaiverChaseTile(): Promise<React.ReactElement | null> {
  try {
    return await LienWaiverChaseTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[LienWaiverChaseTile] render failed:', err);
    return null;
  }
}
