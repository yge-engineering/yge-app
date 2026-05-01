// /subs — subcontractor roster with pre-qualification status at a glance.
//
// Plain English: one row per SUBCONTRACTOR vendor. Sorted with blocked
// subs at the top so missing items are the first thing Brook + Ryan
// see. Print the packet from any row to hand a missing-items list to
// a sub before they show up on a job.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
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
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors?kind=SUBCONTRACTOR`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}

export default async function SubsPage() {
  const subs = await fetchVendors();
  const reports = subs.map((v) => ({ vendor: v, report: buildVendorPrequal(v) }));
  reports.sort((a, b) => {
    const rank = (r: typeof a) =>
      !r.report.ready ? 0 : r.report.advisoryCount > 0 ? 1 : 2;
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    return a.report.vendorName.localeCompare(b.report.vendorName);
  });

  const rollup = computeVendorPrequalRollup(subs);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Subcontractor roster"
          subtitle="Per-sub pre-qualification status. Print the packet from any row to hand a missing-items list to a sub before they show up on a job."
          actions={
            <LinkButton href="/vendors/new" variant="primary" size="md">
              + Add subcontractor
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Subs total" value={rollup.total} />
          <Tile label="Ready (all clear)" value={rollup.ready} tone={rollup.ready > 0 ? 'success' : 'neutral'} />
          <Tile label="Advisory only" value={rollup.advisoryOnly} tone={rollup.advisoryOnly > 0 ? 'warn' : 'success'} />
          <Tile label="Blocked" value={rollup.blocked} tone={rollup.blocked > 0 ? 'danger' : 'success'} />
        </section>

        {reports.length === 0 ? (
          <EmptyState
            title="No subcontractor vendors yet"
            body="Add subs as you onboard them. The pre-qual packet shows missing items — W-9, COI, license — so the sub can fix them before they show up on a job."
            actions={[{ href: '/vendors/new', label: 'Add subcontractor', primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                  const failedRequired = report.checks.filter((c) => !c.pass && c.required);
                  const failedAdvisory = report.checks.filter((c) => !c.pass && !c.required);
                  const rowClass = !report.ready ? 'bg-red-50' : report.advisoryCount > 0 ? 'bg-amber-50' : '';
                  return (
                    <tr key={vendor.id} className={rowClass}>
                      <td className="px-4 py-3">
                        <Link href={`/vendors/${vendor.id}`} className="font-medium text-blue-700 hover:underline">
                          {report.vendorName}
                        </Link>
                        {vendor.dbaName ? <div className="text-xs text-gray-500">{vendor.legalName}</div> : null}
                        {vendor.cslbLicense ? <div className="mt-0.5 text-[10px] text-gray-500">CSLB #{vendor.cslbLicense}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        {report.ready
                          ? report.advisoryCount === 0
                            ? <StatusPill label="Ready" tone="success" />
                            : <StatusPill label="Advisory" tone="warn" />
                          : <StatusPill label="Blocked" tone="danger" />}
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
                        <Link href={`/vendors/${vendor.id}/prequal`} className="text-blue-700 hover:underline">
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
    </AppShell>
  );
}
