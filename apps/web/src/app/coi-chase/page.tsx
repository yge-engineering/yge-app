// /coi-chase — subcontractor COI chase list.

import Link from 'next/link';

import {
  AppShell,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildVendorCoiAging,
  type Vendor,
} from '@yge/shared';

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

function coiMailto(vendor: Vendor, daysToExpiry: number | null): string | null {
  if (!vendor.email) return null;
  const urgency =
    daysToExpiry !== null && daysToExpiry < 0
      ? 'Your COI on file with us has expired.'
      : daysToExpiry !== null
        ? `Your COI on file with us expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}.`
        : 'We don\'t have a COI on file for your company.';
  const subject = `COI request — ${vendor.legalName}`;
  const body = [
    `Hi ${vendor.contactName ?? 'team'},`,
    '',
    urgency,
    '',
    'YGE\'s minimum COI requirements:',
    '  · General Liability: $1M per occurrence / $2M aggregate',
    '  · Auto: $1M combined single limit',
    '  · Workers Comp: statutory',
    '  · YGE listed as Additional Insured (CG2010 / CG2037)',
    '  · 30-day Notice of Cancellation',
    '',
    'Please have your agent issue and email an updated ACORD 25 directly to brookyoung@youngge.com.',
    '',
    'Thanks,',
    'Brook Young',
    'Young General Engineering, Inc.',
    '707-499-7065',
  ].join('%0D%0A');
  return `mailto:${encodeURIComponent(vendor.email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

interface TierMeta {
  tier: 'EXPIRED' | 'EXPIRES_SOON' | 'NO_COI';
  label: string;
  caption: string;
  tone: string;
}

const TIERS: TierMeta[] = [
  {
    tier: 'EXPIRED',
    label: 'Expired COIs',
    caption: 'Stop work order territory. Don\'t schedule new dispatches against these subs until they re-issue.',
    tone: 'border-red-300 bg-red-50',
  },
  {
    tier: 'EXPIRES_SOON',
    label: 'Expires within 30 days',
    caption: 'Chase now so coverage doesn\'t lapse mid-job. Most agents take a couple business days.',
    tone: 'border-amber-300 bg-amber-50',
  },
  {
    tier: 'NO_COI',
    label: 'No COI on file',
    caption: 'Sub may never have been onboarded for compliance. Pull a fresh ACORD 25 before issuing them any new PO.',
    tone: 'border-gray-200 bg-white',
  },
];

export default async function CoiChasePage() {
  requirePermission('financials:edit');
  const vendors = await fetchJson<Vendor>('/api/vendors', 'vendors');
  const now = new Date();
  const { rows, rollup } = buildVendorCoiAging({
    vendors,
    asOf: now.toISOString().slice(0, 10),
  });

  const vendorById = new Map<string, Vendor>();
  for (const v of vendors) vendorById.set(v.id, v);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="COI chase list"
          subtitle={`Subcontractor COIs needing attention. ${rollup.expired} expired · ${rollup.expiresSoon} expiring soon · ${rollup.noCoi} no COI on file.`}
        />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className={`rounded-md border p-3 ${rollup.expired > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Expired
            </div>
            <div className={`mt-1 text-2xl font-bold ${rollup.expired > 0 ? 'text-red-700' : 'text-yge-blue-900'}`}>
              {rollup.expired}
            </div>
          </div>
          <div className={`rounded-md border p-3 ${rollup.expiresSoon > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Expires &lt; 30d
            </div>
            <div className={`mt-1 text-2xl font-bold ${rollup.expiresSoon > 0 ? 'text-amber-700' : 'text-yge-blue-900'}`}>
              {rollup.expiresSoon}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              No COI
            </div>
            <div className="mt-1 text-2xl font-bold text-yge-blue-900">
              {rollup.noCoi}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Current
            </div>
            <div className="mt-1 text-2xl font-bold text-green-700">
              {rollup.current}
            </div>
          </div>
        </div>

        {rollup.expired + rollup.expiresSoon + rollup.noCoi === 0 ? (
          <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Every subcontractor has a current COI on file. ✓
          </p>
        ) : (
          <div className="space-y-4">
            {TIERS.map((meta) => {
              const tierRows = rows.filter((r) => r.tier === meta.tier);
              if (tierRows.length === 0) return null;
              return (
                <section
                  key={meta.tier}
                  className={`rounded-md border p-4 ${meta.tone}`}
                >
                  <header className="mb-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800">
                      {meta.label} — {tierRows.length}
                    </h2>
                    <p className="text-xs text-gray-700">{meta.caption}</p>
                  </header>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-2 py-1">Sub</th>
                        <th className="px-2 py-1">Expires</th>
                        <th className="px-2 py-1 text-right">Days</th>
                        <th className="px-2 py-1">Email</th>
                        <th className="px-2 py-1">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tierRows.map((r) => {
                        const v = vendorById.get(r.vendorId);
                        const mailto = v ? coiMailto(v, r.daysToExpiry) : null;
                        return (
                          <tr key={r.vendorId}>
                            <td className="px-2 py-1">
                              <Link
                                href={`/vendors/${r.vendorId}`}
                                className="text-yge-blue-700 hover:underline"
                              >
                                {r.vendorName}
                              </Link>
                              {r.onHold ? (
                                <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
                                  On hold
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1 font-mono text-xs">
                              {r.coiExpiresOn ?? '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-xs">
                              {r.daysToExpiry === null
                                ? '—'
                                : r.daysToExpiry < 0
                                  ? `${Math.abs(r.daysToExpiry)} past`
                                  : `${r.daysToExpiry}`}
                            </td>
                            <td className="px-2 py-1 text-xs text-gray-700">
                              {v?.email ?? <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-2 py-1">
                              {mailto ? (
                                <a
                                  href={mailto}
                                  className="rounded bg-yge-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-yge-blue-700"
                                >
                                  Email COI request
                                </a>
                              ) : (
                                <span className="text-[11px] text-gray-400">
                                  No email on file
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Insurance-cert templates assume our standard subcontractor
          requirements (CGL $1M/$2M, Auto $1M, WC statutory, AI status,
          30-day NOC). Edit the email before sending if a job has bigger
          limits.
        </p>
      </main>
    </AppShell>
  );
}
