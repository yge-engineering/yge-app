import * as React from 'react';
// Dashboard tile — W-9 chase summary.
//
// Plain English: how many 1099-reportable vendors are over the
// $600 threshold without a current W-9? Red = IRS-blocker territory.

import Link from 'next/link';
import type { ApInvoice, Vendor } from '@yge/shared';
import { buildVendorW9Chase } from '@yge/shared';

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

async function W9ChaseTileInner() {
  const [vendors, apInvoices] = await Promise.all([
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
  ]);

  const { rollup } = buildVendorW9Chase({
    vendors,
    apInvoices,
    asOf: new Date().toISOString().slice(0, 10),
  });

  // Skip rendering when nothing to chase.
  if (rollup.total === 0) return null;

  const tone =
    rollup.overThreshold > 0
      ? 'border-red-300 bg-red-50'
      : rollup.approaching > 0
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            W-9 chase list
          </h2>
          <p className="text-xs text-gray-600">
            {rollup.overThreshold > 0
              ? `⚠︎ ${rollup.overThreshold} vendor${rollup.overThreshold === 1 ? '' : 's'} over $600 missing a W-9 — IRS blocker.`
              : rollup.approaching > 0
                ? `${rollup.approaching} approaching $600 — chase before threshold.`
                : `${rollup.reportable} 1099-reportable vendor${rollup.reportable === 1 ? '' : 's'} need W-9.`}
          </p>
        </div>
        <Link
          href="/vendor-w9-chase"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Chase list →
        </Link>
      </header>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Over $600
          </dt>
          <dd
            className={`font-mono text-base font-semibold ${rollup.overThreshold > 0 ? 'text-red-700' : 'text-gray-800'}`}
          >
            {rollup.overThreshold}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Approaching
          </dt>
          <dd
            className={`font-mono text-base font-semibold ${rollup.approaching > 0 ? 'text-amber-700' : 'text-gray-800'}`}
          >
            {rollup.approaching}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Reportable
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            {rollup.reportable}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Resilient wrapper — if anything throws inside W9ChaseTileInner (bad
// data shape, API timeout, builder bug), we render null instead of
// crashing the dashboard. Errors get logged server-side.
export async function W9ChaseTile(): Promise<React.ReactElement | null> {
  try {
    return await W9ChaseTileInner();
  } catch (err) {
    console.error('[W9ChaseTile] render failed:', err);
    return null;
  }
}
