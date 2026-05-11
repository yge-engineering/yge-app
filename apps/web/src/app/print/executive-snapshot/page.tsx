// /print/executive-snapshot — print-optimized exec snapshot.
//
// No AppShell. Letter-size friendly layout. Brook prints this for
// board / bank / bonding meetings; no need to screenshot the
// in-app version.

import {
  Money,
} from '../../../components';
import { requirePermission } from '../../../lib/permissions';
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

export default async function PrintExecutiveSnapshotPage() {
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

  const byAccount = new Map<string, BankRec>();
  for (const r of bankRecs) {
    const cur = byAccount.get(r.bankAccountLabel);
    if (!cur || r.statementDate > cur.statementDate) {
      byAccount.set(r.bankAccountLabel, r);
    }
  }
  let totalCash = 0;
  for (const r of byAccount.values()) totalCash += r.glBalanceCents;

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-6 text-black print:max-w-none print:px-4 print:py-0">
      <header className="mb-4 border-b-2 border-gray-800 pb-2">
        <h1 className="text-xl font-bold">Young General Engineering, Inc.</h1>
        <p className="text-sm">Executive snapshot — {end}</p>
      </header>

      <section className="mb-4">
        <h2 className="mb-2 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          Headline metrics ({year} YTD)
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-3 font-semibold">Cash on hand:</td>
              <td className="py-1 pr-3 font-mono">
                <Money cents={totalCash} />
              </td>
              <td className="py-1 pr-3 font-semibold">Accounts:</td>
              <td className="py-1 font-mono">{byAccount.size}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-semibold">YTD revenue:</td>
              <td className="py-1 pr-3 font-mono">
                <Money cents={cust.totalBilledCents} />
              </td>
              <td className="py-1 pr-3 font-semibold">YTD spend:</td>
              <td className="py-1 font-mono">
                <Money cents={vSpend.totalSpendCents} />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-semibold">Net YTD:</td>
              <td className="py-1 pr-3 font-mono">
                <Money cents={cust.totalBilledCents - vSpend.totalSpendCents} />
              </td>
              <td className="py-1 pr-3 font-semibold">Open AR:</td>
              <td className="py-1 font-mono">
                <Money cents={arAging.totalOpenCents} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          Customer + vendor concentration
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-3 font-semibold">Top customer:</td>
              <td className="py-1 pr-3">{cust.rows[0]?.customerName ?? '—'}</td>
              <td className="py-1 pr-3 font-mono">
                {(cust.top1SharePct * 100).toFixed(0)}%
              </td>
              <td className="py-1 font-semibold">HHI:</td>
              <td className="py-1 font-mono">
                {Math.round(cust.hhi).toLocaleString()}
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-semibold">Top-5 customers:</td>
              <td className="py-1 pr-3" colSpan={2}>
                <span className="font-mono">
                  {(cust.top5SharePct * 100).toFixed(0)}%
                </span>{' '}
                of revenue
              </td>
              <td className="py-1 font-semibold">Top-5 vendors:</td>
              <td className="py-1 font-mono">
                {(vSpend.top5SharePct * 100).toFixed(0)}%
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          AR aging buckets
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">0-30d</th>
              <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">31-60d</th>
              <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">61-90d</th>
              <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">90+d</th>
              <th className="border-b border-gray-300 py-1 text-left text-xs uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 font-mono">
                <Money cents={arAging.bucketTotals['0-30'] ?? 0} />
              </td>
              <td className="py-1 font-mono">
                <Money cents={arAging.bucketTotals['31-60'] ?? 0} />
              </td>
              <td className="py-1 font-mono">
                <Money cents={arAging.bucketTotals['61-90'] ?? 0} />
              </td>
              <td className="py-1 font-mono">
                <Money cents={arAging.bucketTotals['90+'] ?? 0} />
              </td>
              <td className="py-1 font-mono font-semibold">
                <Money cents={arAging.totalOpenCents} />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 border-b border-gray-300 text-sm font-bold uppercase tracking-wide">
          Tax + compliance posture
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-3 font-semibold">1099 reportable vendors:</td>
              <td className="py-1 pr-3 font-mono">{tax.reportableCount}</td>
              <td className="py-1 pr-3 font-semibold">Missing W-9:</td>
              <td className="py-1 font-mono">{tax.missingW9Count}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-semibold">Subs with COI on file:</td>
              <td className="py-1 pr-3 font-mono">{coi.rollup.current}</td>
              <td className="py-1 pr-3 font-semibold">Expired COIs:</td>
              <td className="py-1 font-mono">{coi.rollup.expired}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 font-semibold">COIs expiring &lt; 30d:</td>
              <td className="py-1 pr-3 font-mono">{coi.rollup.expiresSoon}</td>
              <td className="py-1 pr-3 font-semibold">No COI on file:</td>
              <td className="py-1 font-mono">{coi.rollup.noCoi}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-6 border-t border-gray-300 pt-2 text-[10px] text-gray-600">
        Generated from YGE App. Cash position is the latest reconciled
        GL balance across {byAccount.size} bank accounts. Revenue +
        spend exclude DRAFT / REJECTED / WRITTEN_OFF records.
      </footer>
    </main>
  );
}
