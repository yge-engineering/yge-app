import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — subcontractor COI aging.
//
// Plain English: how many subs are walking around without
// current COIs? Red if any expired, amber if any expire soon.

import Link from 'next/link';
import { buildVendorCoiAging, type Vendor } from '@yge/shared';

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

async function CoiAgingTileInner() {
  const vendors = await fetchJson<Vendor>('/api/vendors', 'vendors');
  const { rollup } = buildVendorCoiAging({
    vendors,
    asOf: new Date().toISOString().slice(0, 10),
  });

  if (rollup.subsConsidered === 0) return null;

  const hasExpired = rollup.expired > 0;
  const hasSoon = rollup.expiresSoon > 0;
  const tone = hasExpired
    ? 'border-red-300 bg-red-50'
    : hasSoon
      ? 'border-amber-300 bg-amber-50'
      : 'border-green-300 bg-green-50';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Sub COI aging
          </h2>
          <p className="text-xs text-gray-600">
            {hasExpired
              ? `⚠︎ ${rollup.expired} expired COI${rollup.expired === 1 ? '' : 's'} — stop-work risk. Chase today.`
              : hasSoon
                ? `${rollup.expiresSoon} expire within 30 days — chase this week.`
                : 'All subs current.'}
          </p>
        </div>
        <Link
          href="/coi-chase"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Chase list →
        </Link>
      </header>
      <dl className="mt-3 grid grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Expired
          </dt>
          <dd className={`font-mono text-base font-semibold ${hasExpired ? 'text-red-700' : 'text-gray-800'}`}>
            {rollup.expired}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            &lt; 30d
          </dt>
          <dd className={`font-mono text-base font-semibold ${hasSoon ? 'text-amber-700' : 'text-gray-800'}`}>
            {rollup.expiresSoon}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            No COI
          </dt>
          <dd className="font-mono text-base font-semibold text-gray-800">
            {rollup.noCoi}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Current
          </dt>
          <dd className="font-mono text-base font-semibold text-green-700">
            {rollup.current}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Resilient wrapper — if anything throws inside CoiAgingTileInner (bad
// data shape, API timeout, builder bug), we render null instead of
// crashing the dashboard. Errors get logged server-side.
export async function CoiAgingTile(): Promise<React.ReactElement | null> {
  try {
    return await CoiAgingTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[CoiAgingTile] render failed:', err);
    return null;
  }
}
