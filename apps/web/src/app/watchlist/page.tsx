// /watchlist — certification + COI expiry rollup.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  bucketLabel,
  computeWatchlistRollup,
  rowsFromEmployees,
  rowsFromVendors,
  sortWatchlistRows,
  type Employee,
  type Vendor,
  type WatchlistBucket,
  type WatchlistRow,
} from '@yge/shared';

const BUCKETS: WatchlistBucket[] = ['EXPIRED', 'WITHIN_30', 'WITHIN_60', 'WITHIN_90', 'BEYOND'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { employees: Employee[] }).employees;
}
async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors?kind=SUBCONTRACTOR`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return ((await res.json()) as { vendors: Vendor[] }).vendors;
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: { kind?: string; bucket?: string };
}) {
  const [employees, vendors] = await Promise.all([fetchEmployees(), fetchVendors()]);
  const allRows = sortWatchlistRows([
    ...rowsFromEmployees(employees),
    ...rowsFromVendors(vendors),
  ]);

  let visible = allRows;
  if (searchParams.kind === 'EMPLOYEE_CERT' || searchParams.kind === 'SUB_COI') {
    visible = visible.filter((r) => r.kind === searchParams.kind);
  }
  if (
    searchParams.bucket &&
    BUCKETS.includes(searchParams.bucket as WatchlistBucket)
  ) {
    visible = visible.filter((r) => r.bucket === searchParams.bucket);
  }

  const rollup = computeWatchlistRollup(allRows);

  function buildHref(overrides: Partial<{ kind?: string; bucket?: string }>) {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.kind) params.set('kind', merged.kind);
    if (merged.bucket) params.set('bucket', merged.bucket);
    const q = params.toString();
    return q ? `/watchlist?${q}` : '/watchlist';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Cert Watchlist</h1>
      <p className="mt-2 text-gray-700">
        Every employee certification + every subcontractor COI, ranked by
        expiration. Don't put a guy with a lapsed CDL on a road crew, and
        don't schedule a sub whose COI just expired.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-5">
        <Stat
          label="Expired"
          value={rollup.expired}
          variant={rollup.expired > 0 ? 'bad' : 'ok'}
        />
        <Stat
          label="Within 30 days"
          value={rollup.within30}
          variant={rollup.within30 > 0 ? 'warn' : 'ok'}
        />
        <Stat label="Within 60 days" value={rollup.within60} />
        <Stat label="Within 90 days" value={rollup.within90} />
        <Stat
          label="People needing action"
          value={rollup.immediateActionSubjects}
          variant={rollup.immediateActionSubjects > 0 ? 'warn' : 'ok'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Kind:</span>
        <Chip
          href={buildHref({ kind: undefined })}
          active={!searchParams.kind}
          label="All"
        />
        <Chip
          href={buildHref({ kind: 'EMPLOYEE_CERT' })}
          active={searchParams.kind === 'EMPLOYEE_CERT'}
          label="Employee certs"
        />
        <Chip
          href={buildHref({ kind: 'SUB_COI' })}
          active={searchParams.kind === 'SUB_COI'}
          label="Sub COIs"
        />
        <span className="ml-4 text-xs uppercase tracking-wide text-gray-500">
          Bucket:
        </span>
        <Chip
          href={buildHref({ bucket: undefined })}
          active={!searchParams.bucket}
          label="All"
        />
        {BUCKETS.map((b) => (
          <Chip
            key={b}
            href={buildHref({ bucket: b })}
            active={searchParams.bucket === b}
            label={bucketLabel(b)}
          />
        ))}
      </section>

      {visible.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          Nothing in this filter. Either you're current or you haven't recorded
          expiration dates yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Expires</th>
                <th className="px-4 py-2 text-right">Days</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => (
                <BucketRow key={r.rowId} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}

function BucketRow({ r }: { r: WatchlistRow }) {
  const cls =
    r.bucket === 'EXPIRED'
      ? 'bg-red-50'
      : r.bucket === 'WITHIN_30'
        ? 'bg-yellow-50'
        : '';
  const badgeCls =
    r.bucket === 'EXPIRED'
      ? 'bg-red-100 text-red-800'
      : r.bucket === 'WITHIN_30'
        ? 'bg-yellow-100 text-yellow-800'
        : r.bucket === 'WITHIN_60'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-gray-100 text-gray-700';
  return (
    <tr className={cls}>
      <td className="px-4 py-3 text-sm">
        <div className="font-medium text-gray-900">{r.subjectName}</div>
        <div className="text-[10px] text-gray-500">
          {r.kind === 'EMPLOYEE_CERT' ? 'Employee' : 'Subcontractor'}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-700">
        {r.itemLabel}
        {r.issuer && <div className="text-[10px] text-gray-500">{r.issuer}</div>}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.expiresOn}</td>
      <td
        className={`px-4 py-3 text-right font-mono text-sm ${
          r.daysUntilExpiry < 0
            ? 'font-bold text-red-700'
            : r.daysUntilExpiry <= 30
              ? 'font-semibold text-yellow-800'
              : 'text-gray-700'
        }`}
      >
        {r.daysUntilExpiry < 0 ? `${r.daysUntilExpiry}` : `+${r.daysUntilExpiry}`}
      </td>
      <td className="px-4 py-3 text-xs">
        <span
          className={`inline-block rounded px-1.5 py-0.5 font-semibold ${badgeCls}`}
        >
          {bucketLabel(r.bucket)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Link href={r.href} className="text-yge-blue-500 hover:underline">
          Open
        </Link>
      </td>
    </tr>
  );
}

function Chip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-2 py-1 text-xs ${
        active
          ? 'bg-yge-blue-500 text-white'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
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
