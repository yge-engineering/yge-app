// /executive-snapshot — one-page board / bank / bonding read.

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import {
  buildArAgingReport,
  buildCustomerConcentration,
  buildVendor1099Report,
  buildVendorCoiAging,
  buildVendorSpendReport,
  type ApInvoice,
  type ApPayment,
  type ArInvoice,
  type BankRec,
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

export default async function ExecutiveSnapshotPage() {
  requirePermission('financials:view');

  const now = new Date();
  const year = now.getUTCFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);

  const [arInvoices, apInvoices, apPayments, vendors, bankRecs] =
    await Promise.all([
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
      fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
      fetchJson<ApPayment>('/api/ap-payments', 'payments'),
      fetchJson<Vendor>('/api/vendors', 'vendors'),
      fetchJson<BankRec>('/api/bank-recs', 'recs'),
    ]);

  const cust = buildCustomerConcentration({ start, end, arInvoices });
  const vSpend = buildVendorSpendReport({ start, end, apInvoices });
  const tax = buildVendor1099Report({
    year,
    vendors,
    payments: apPayments,
    asOf: now,
  });
  const coi = buildVendorCoiAging({ vendors, asOf: end });
  const arAging = buildArAgingReport({ asOf: end, arInvoices });

  // Cash position
  const byAccount = new Map<string, BankRec>();
  for (const r of bankRecs) {
    const cur = byAccount.get(r.bankAccountLabel);
    if (!cur || r.statementDate > cur.statementDate) {
      byAccount.set(r.bankAccountLabel, r);
    }
  }
  let totalCash = 0;
  for (const r of byAccount.values()) totalCash += r.glBalanceCents;

  // Total YTD revenue
  const totalRevenueYtd = cust.totalBilledCents;
  // Total YTD spend
  const totalSpendYtd = vSpend.totalSpendCents;
  // Net cash position vs spend ratio (rough months of cash)
  const monthlyBurnEstimate = totalSpendYtd / Math.max(1, now.getUTCMonth() + 1);
  const monthsOfCash = monthlyBurnEstimate > 0
    ? totalCash / monthlyBurnEstimate
    : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Executive snapshot"
          subtitle={`Young General Engineering, Inc. · As of ${end} · ${year} YTD`}
        />

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Headline metrics
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                Cash on hand
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                <Money cents={totalCash} />
              </dd>
              <div className="text-[10px] text-gray-500">
                {byAccount.size} account{byAccount.size === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                YTD revenue
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                <Money cents={totalRevenueYtd} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                YTD spend
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                <Money cents={totalSpendYtd} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                Net YTD
              </dt>
              <dd
                className={`font-mono text-base font-semibold ${
                  totalRevenueYtd - totalSpendYtd >= 0
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                <Money cents={totalRevenueYtd - totalSpendYtd} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-600">
            Cash covers approximately{' '}
            {monthsOfCash !== null && Number.isFinite(monthsOfCash) ? (
              <strong>{monthsOfCash.toFixed(1)} months</strong>
            ) : (
              <span className="text-gray-400">—</span>
            )}{' '}
            of current burn (YTD spend ÷ months elapsed).
          </p>
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Concentration
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                Top customer
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                {(cust.top1SharePct * 100).toFixed(0)}%
              </dd>
              <div className="text-[10px] text-gray-500">
                {cust.rows[0]?.customerName ?? '—'}
              </div>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                Top-5 vendors
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                {(vSpend.top5SharePct * 100).toFixed(0)}%
              </dd>
              <div className="text-[10px] text-gray-500">
                {vSpend.vendorCount} vendors used
              </div>
            </div>
          </dl>
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            AR aging
          </h2>
          <dl className="grid grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                0–30d
              </dt>
              <dd className="font-mono font-semibold text-yge-blue-900">
                <Money cents={arAging.bucketTotals['0-30'] ?? 0} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                31–60d
              </dt>
              <dd className="font-mono font-semibold text-yge-blue-900">
                <Money cents={arAging.bucketTotals['31-60'] ?? 0} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                61–90d
              </dt>
              <dd className="font-mono font-semibold text-amber-700">
                <Money cents={arAging.bucketTotals['61-90'] ?? 0} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                90+d
              </dt>
              <dd className="font-mono font-semibold text-red-700">
                <Money cents={arAging.bucketTotals['90+'] ?? 0} />
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-gray-600">
            Total open AR <Money cents={arAging.totalOpenCents} />.
          </p>
        </section>

        <section className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Compliance + tax
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                1099 reportable
              </dt>
              <dd className="font-mono text-base font-semibold text-yge-blue-900">
                {tax.reportableCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                Missing W-9
              </dt>
              <dd
                className={`font-mono text-base font-semibold ${
                  tax.missingW9Count > 0 ? 'text-red-700' : 'text-yge-blue-900'
                }`}
              >
                {tax.missingW9Count}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                COI expired
              </dt>
              <dd
                className={`font-mono text-base font-semibold ${
                  coi.rollup.expired > 0 ? 'text-red-700' : 'text-yge-blue-900'
                }`}
              >
                {coi.rollup.expired}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-gray-500">
                COI &lt; 30d
              </dt>
              <dd
                className={`font-mono text-base font-semibold ${
                  coi.rollup.expiresSoon > 0 ? 'text-amber-700' : 'text-yge-blue-900'
                }`}
              >
                {coi.rollup.expiresSoon}
              </dd>
            </div>
          </dl>
        </section>

        <p className="mt-6 text-xs text-gray-500">
          One-page snapshot drawn from cash position, AR aging, vendor +
          customer concentration, 1099 + COI compliance. Use this for
          board / bank / bonding meetings — pair with the
          balance-sheet and income-statement printouts for full context.
        </p>
      </main>
    </AppShell>
  );
}
