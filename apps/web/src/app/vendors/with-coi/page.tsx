// /vendors/with-coi — vendors with a current certificate of
// insurance on file.
//
// Plain English: lists every vendor where coiOnFile=true AND the
// coiExpiresOn date hasn't passed. Office uses this to verify which
// subs are clear to issue POs to without chasing a fresh COI.
// Pairs with /vendors/coi-aging (the chase list).
//
// Was a placeholder for months — this is the real page.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '../../../components/print-button';
import { requirePermission } from '../../../lib/permissions';
import { vendorCoiCurrent, type Vendor } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse { vendors?: Vendor[] }

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).vendors ?? [];
  } catch {
    return [];
  }
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const due = new Date(iso + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default async function VendorsWithCoiPage() {
  requirePermission('financials:view');
  const vendors = await fetchVendors();
  const now = new Date();
  const withCoi = vendors
    .filter((v) => vendorCoiCurrent(v, now))
    .sort((a, b) => {
      // Soonest-expiring first; vendors without expiry date sink to the
      // bottom so the office can see who needs the most urgent re-chase.
      if (!a.coiExpiresOn && !b.coiExpiresOn) return a.legalName.localeCompare(b.legalName);
      if (!a.coiExpiresOn) return 1;
      if (!b.coiExpiresOn) return -1;
      return a.coiExpiresOn.localeCompare(b.coiExpiresOn);
    });

  // Roll up the freshness mix so the tile row tells the story.
  let untracked = 0;
  let expiringSoon = 0;
  let healthy = 0;
  for (const v of withCoi) {
    if (!v.coiExpiresOn) untracked += 1;
    else {
      const d = daysUntil(v.coiExpiresOn);
      if (d != null && d <= 30) expiringSoon += 1;
      else healthy += 1;
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/vendors"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            &larr; All vendors
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/vendors/coi-aging"
              className="text-yge-blue-500 hover:underline"
            >
              COI aging (chase list) →
            </Link>
            <PrintButton label="Print list" />
          </div>
        </div>

        <PageHeader
          title="Vendors with COI on file"
          subtitle="Subs and suppliers clear to receive POs today. Pulled from the vendor master; refresh after recording a renewed certificate."
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-4">
          <Tile label="With current COI" value={String(withCoi.length)} />
          <Tile label="Healthy (>30d)" value={String(healthy)} tone="ready" />
          <Tile
            label="Expiring within 30d"
            value={String(expiringSoon)}
            tone={expiringSoon > 0 ? 'warn' : undefined}
          />
          <Tile
            label="No expiry tracked"
            value={String(untracked)}
            tone={untracked > 0 ? 'warn' : undefined}
          />
        </section>

        {withCoi.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
            No vendors have a current COI on file. Either no certificates
            have been recorded yet, or every one on file has expired —{' '}
            <Link
              href="/vendors/coi-aging"
              className="text-yge-blue-500 hover:underline"
            >
              chase the expired ones
            </Link>
            .
          </p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">CSLB / DIR</th>
                  <th className="px-3 py-2 text-left">Expires</th>
                  <th className="px-3 py-2 text-right">Days left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withCoi.map((v) => {
                  const d = daysUntil(v.coiExpiresOn);
                  const ageTone =
                    d == null
                      ? 'text-gray-500'
                      : d <= 14
                        ? 'text-red-700'
                        : d <= 30
                          ? 'text-amber-700'
                          : 'text-emerald-700';
                  return (
                    <tr key={v.id}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/vendors/${v.id}`}
                          className="font-medium text-yge-blue-500 hover:underline"
                        >
                          {v.legalName}
                        </Link>
                        {v.contactName && (
                          <div className="text-xs text-gray-500">
                            {v.contactName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-600">
                        {v.kind}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {v.cslbLicense ?? '—'}
                        {v.dirRegistration && (
                          <span className="text-gray-500"> · DIR {v.dirRegistration}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {v.coiExpiresOn ?? 'not tracked'}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs ${ageTone}`}>
                        {d == null ? '—' : d < 0 ? `EXPIRED ${Math.abs(d)}d ago` : `${d}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-6 text-xs text-gray-500">
          A vendor counts as &quot;current&quot; when{' '}
          <code className="rounded bg-gray-100 px-1">coiOnFile=true</code> and
          either no expiration was recorded or the recorded date is in the
          future. Update either flag from the per-vendor detail page.
        </p>
      </main>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ready' | 'warn';
}) {
  const valueCls =
    tone === 'ready'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}
