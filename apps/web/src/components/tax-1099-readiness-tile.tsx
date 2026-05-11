// Dashboard tile — 1099-NEC readiness for the current calendar year.
//
// Plain English: as of right now, how many vendors are over the
// $600 threshold, and how many of those don't have a current W-9
// on file? Drops a red tile if W-9 chasing is needed.

import Link from 'next/link';
import type { ApPayment, Vendor } from '@yge/shared';
import { buildVendor1099Report } from '@yge/shared';

import { Money } from './money';

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

export async function Tax1099ReadinessTile() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const [vendors, payments] = await Promise.all([
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<ApPayment>('/api/ap-payments', 'payments'),
  ]);

  const report = buildVendor1099Report({ year, vendors, payments, asOf: now });

  const hasBlockers = report.missingW9Count > 0;
  const borderColor = hasBlockers
    ? 'border-red-300 bg-red-50'
    : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${borderColor} p-4`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            1099-NEC readiness — {year}
          </h2>
          <p className="text-xs text-gray-600">
            {hasBlockers
              ? `${report.missingW9Count} vendor${report.missingW9Count === 1 ? '' : 's'} over $600 missing a current W-9 — chase before January 31.`
              : report.reportableCount === 0
                ? 'No reportable vendors yet this year.'
                : `${report.reportableCount} reportable vendor${report.reportableCount === 1 ? '' : 's'}, all with current W-9. Worksheet ready.`}
          </p>
        </div>
        <Link
          href="/1099-worksheet"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Open worksheet →
        </Link>
      </header>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Reportable
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            {report.reportableCount}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Total YTD
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            <Money cents={report.totalReportableCents} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Missing W-9
          </dt>
          <dd
            className={`font-mono text-base font-semibold ${hasBlockers ? 'text-red-700' : 'text-gray-800'}`}
          >
            {report.missingW9Count}
          </dd>
        </div>
      </dl>
    </section>
  );
}
