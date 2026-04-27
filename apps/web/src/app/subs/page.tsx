// /subs — subcontractor roster with pre-qualification status at a glance.
//
// One row per SUBCONTRACTOR vendor. Sorted with blocked subs at the
// top so missing items are the first thing Brook + Ryan see.

import Link from 'next/link';
import {
  buildVendorPrequal,
  computeVendorPrequalRollup,
  type Vendor,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors?kind=SUBCONTRACTOR`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return ((await res.json()) as { vendors: Vendor[] }).vendors;
}

export default async function SubsPage() {
  const subs = await fetchVendors();
  const reports = subs.map((v) => ({ vendor: v, report: buildVendorPrequal(v) }));
  // Sort: blocked first, then advisory-only, then ready. Within each
  // bucket, alphabetical.
  reports.sort((a, b) => {
    const rank = (r: typeof a) =>
      !r.report.ready ? 0 : r.report.advisoryCount > 0 ? 1 : 2;
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    return a.report.vendorName.localeCompare(b.report.vendorName);
  });

  const rollup = computeVendorPrequalRollup(subs);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/vendors/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add subcontractor
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Subcontractor Roster</h1>
      <p className="mt-2 text-gray-700">
        Per-sub pre-qualification status. Print the packet from any row to
        hand a missing-items list to a sub before they show up on a job.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Subs total" value={rollup.total} />
        <Stat
          label="Ready (all clear)"
          value={rollup.ready}
          variant={rollup.ready > 0 ? 'ok' : 'neutral'}
        />
        <Stat
          label="Advisory only"
          value={rollup.advisoryOnly}
          variant={rollup.advisoryOnly > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Blocked"
          value={rollup.blocked}
          variant={rollup.blocked > 0 ? 'bad' : 'ok'}
        />
      </section>

      {reports.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No subcontractor vendors yet.{' '}
          <Link href="/vendors/new" className="text-yge-blue-500 hover:underline">
            Add one &rarr;
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Sub</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Missing required</th>
                <th className="px-4 py-2">Advisory</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map(({ vendor, report }) => {
                const failedRequired = report.checks.filter(
                  (c) => !c.pass && c.required,
                );
                const failedAdvisory = report.checks.filter(
                  (c) => !c.pass && !c.required,
                );
                return (
                  <tr
                    key={vendor.id}
                    className={
                      !report.ready
                        ? 'bg-red-50'
                        : report.advisoryCount > 0
                          ? 'bg-yellow-50'
                          : ''
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {report.vendorName}
                      </div>
                      {vendor.dbaName && (
                        <div className="text-xs text-gray-500">{vendor.legalName}</div>
                      )}
                      {vendor.cslbLicense && (
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          CSLB #{vendor.cslbLicense}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {report.ready ? (
                        report.advisoryCount === 0 ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800">
                            Ready
                          </span>
                        ) : (
                          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-semibold text-yellow-800">
                            Advisory
                          </span>
                        )
                      ) : (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
                          Blocked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {failedRequired.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <ul className="list-disc pl-4">
                          {failedRequired.map((c) => (
                            <li key={c.id}>{c.label}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {failedAdvisory.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <ul className="list-disc pl-4">
                          {failedAdvisory.map((c) => (
                            <li key={c.id}>
                              {c.label}
                              {c.detail ? ` (${c.detail})` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Open
                      </Link>
                      {' · '}
                      <Link
                        href={`/vendors/${vendor.id}/prequal`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Packet
                      </Link>
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
