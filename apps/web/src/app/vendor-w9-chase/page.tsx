// /vendor-w9-chase — vendors needing a W-9 chased, ranked by urgency.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildVendorW9Chase,
  type ApInvoice,
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

function chaseMailto(vendor: Vendor, ytdCents: number): string | null {
  if (!vendor.email) return null;
  const subject = `W-9 needed for 1099 filing — ${vendor.legalName}`;
  const body = [
    `Hi ${vendor.contactName ?? 'team'},`,
    '',
    `Our records show YGE has paid you ${(ytdCents / 100).toLocaleString(
      undefined,
      { style: 'currency', currency: 'USD' },
    )} year-to-date. The IRS requires a 1099-NEC for non-corporate vendors paid $600+ per year, and we need your current W-9 on file before we can file.`,
    '',
    'Could you reply with a signed and dated W-9? The blank form is here:',
    'https://www.irs.gov/pub/irs-pdf/fw9.pdf',
    '',
    'Thanks,',
    'Brook Young',
    'Young General Engineering, Inc.',
    '707-499-7065',
  ].join('%0D%0A');
  return `mailto:${encodeURIComponent(vendor.email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

interface TierMeta {
  tier: 'OVER_THRESHOLD_NO_W9' | 'APPROACHING_NO_W9' | 'REPORTABLE_NO_W9';
  label: string;
  caption: string;
  tone: string;
}

const TIERS: TierMeta[] = [
  {
    tier: 'OVER_THRESHOLD_NO_W9',
    label: 'Over $600 — no W-9',
    caption: 'IRS blocker. Chase TODAY. Without a W-9 you can\'t file the 1099 — IRS backup-withholding (30%) is the fallback penalty.',
    tone: 'border-red-300 bg-red-50',
  },
  {
    tier: 'APPROACHING_NO_W9',
    label: 'Approaching $600 — no W-9',
    caption: 'Within 80% of threshold. Chase this month before they tip over.',
    tone: 'border-amber-300 bg-amber-50',
  },
  {
    tier: 'REPORTABLE_NO_W9',
    label: 'Reportable — no W-9 yet',
    caption: 'Vendor is flagged 1099-reportable but YTD spend is low. Collect a W-9 the next time you onboard them on a job.',
    tone: 'border-gray-200 bg-white',
  },
];

export default async function VendorW9ChasePage() {
  requirePermission('financials:edit');

  const now = new Date();
  const [vendors, apInvoices] = await Promise.all([
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
  ]);

  const { rows, rollup } = buildVendorW9Chase({
    vendors,
    apInvoices,
    asOf: now.toISOString().slice(0, 10),
  });

  // Cross-reference rows to Vendor master records so we can pull
  // contact email + name.
  const vendorById = new Map<string, Vendor>();
  for (const v of vendors) vendorById.set(v.id, v);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="W-9 chase list"
          subtitle={`${rollup.total} vendor${rollup.total === 1 ? '' : 's'} need a W-9. Click the mail icon to send a chase email with the IRS form linked.`}
        />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`rounded-md border p-3 ${rollup.overThreshold > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Over $600
            </div>
            <div className={`mt-1 text-2xl font-bold ${rollup.overThreshold > 0 ? 'text-red-700' : 'text-yge-blue-900'}`}>
              {rollup.overThreshold}
            </div>
            <div className="text-[10px] text-gray-500">
              <Money cents={rollup.overThresholdSpendCents} /> stuck
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Approaching
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-700">
              {rollup.approaching}
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Reportable
            </div>
            <div className="mt-1 text-2xl font-bold text-yge-blue-900">
              {rollup.reportable}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            All clear — every 1099-reportable vendor has a current W-9. ✓
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
                        <th className="px-2 py-1">Vendor</th>
                        <th className="px-2 py-1 text-right">YTD paid</th>
                        <th className="px-2 py-1 text-right">Invoices</th>
                        <th className="px-2 py-1">Email</th>
                        <th className="px-2 py-1">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tierRows.map((r) => {
                        const v = vendorById.get(r.vendorId);
                        const mailto = v ? chaseMailto(v, r.ytdSpendCents) : null;
                        return (
                          <tr key={r.vendorId}>
                            <td className="px-2 py-1">
                              <Link
                                href={`/vendors/${r.vendorId}`}
                                className="text-yge-blue-700 hover:underline"
                              >
                                {r.vendorName}
                              </Link>
                            </td>
                            <td className="px-2 py-1 text-right font-mono font-semibold">
                              <Money cents={r.ytdSpendCents} />
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-xs text-gray-600">
                              {r.invoiceCount}
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
                                  Email W-9 request
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
          The chase email opens in your default mail client with the
          subject + body prefilled and the IRS W-9 form linked. Edit
          before sending if needed.
        </p>
      </main>
    </AppShell>
  );
}
