// /finance/cash-and-bonds — unified Bonding / Retention / Lien
// command center.
//
// Plain English: Brook's "where am I exposed?" dashboard. Three
// numbers in one place that today live on three separate pages:
//
//   Bonding     - how much surety capacity is currently used vs.
//                 available; flag when a new bid would exceed cap
//   Retention   - dollars held by owners + open prompt-pay clocks
//                 (CA PCC §7107) + statutory interest accruing
//   Lien        - lien waivers in flight; nothing should leave YGE
//                 without the matching waiver
//
// Each tile deep-links to its dedicated page. The point of this
// surface is the *combined* view — every Friday Brook looks at
// the three at once to decide whether to pull cash, push a sub
// for a waiver, or hold on a bid.
//
// v6.2 project plan explicitly calls this out as
// "bonding / retention / lien command center". The three pages
// already exist; this dashboard pulls them together.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '../../../components/print-button';
import { requirePermission } from '../../../lib/permissions';
import {
  buildJobRetentionStatus,
  computeRetentionRollup,
  rollupBondCapacity,
  type ArInvoice,
  type ArPayment,
  type LienWaiver,
  type MasterProfile,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMasterProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MasterProfile }).profile;
  } catch { return null; }
}

async function fetchArInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch { return []; }
}

async function fetchArPayments(): Promise<ArPayment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-payments`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { payments: ArPayment[] }).payments;
  } catch { return []; }
}

async function fetchLienWaivers(): Promise<LienWaiver[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/lien-waivers`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { lienWaivers: LienWaiver[] }).lienWaivers;
  } catch { return []; }
}

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default async function CashAndBondsPage() {
  requirePermission('financials:view');

  const [profile, invoices, payments, waivers] = await Promise.all([
    fetchMasterProfile(),
    fetchArInvoices(),
    fetchArPayments(),
    fetchLienWaivers(),
  ]);

  // ---- Bonding rollup -------------------------------------------------
  // Pull aggregate capacity straight off the master profile. Without
  // an active bond on file the tile shows "not configured" rather
  // than zero (Brook needs to enter surety data before this rolls up).
  const aggregateCapCents = profile?.bonding?.aggregateLimitCents ?? 0;
  const singleJobCapCents = profile?.bonding?.singleJobLimitCents ?? 0;
  const bondingConfigured = aggregateCapCents > 0 && Boolean(profile?.bonding?.suretyName);
  // For now the dashboard doesn't pull live bonded-jobs data — that's
  // on the dedicated /bond-capacity page where Brook can adjust the
  // open-job list manually. We just surface the cap + a deep-link.
  const bondingRollup = rollupBondCapacity(aggregateCapCents, []);

  // ---- Retention rollup -----------------------------------------------
  // buildJobRetentionStatus takes per-job invoice/payment slices so
  // the §7107 interest projection is per-job. We don't have
  // completion-notice dates from a single endpoint yet; leaving them
  // undefined just means the interest column reads "—" for now.
  const jobIds = Array.from(new Set(invoices.map((i) => i.jobId)));
  const retentionStatuses = jobIds.map((jobId) => {
    const jobInvoices = invoices.filter((i) => i.jobId === jobId);
    const jobPayments = payments.filter((p) => p.jobId === jobId);
    const customerName = jobInvoices[0]?.customerName ?? '—';
    return buildJobRetentionStatus({
      jobId,
      customerName,
      invoices: jobInvoices,
      payments: jobPayments,
    });
  });
  const retentionRollup = computeRetentionRollup(retentionStatuses);

  // ---- Lien rollup ----------------------------------------------------
  // Waivers we've drafted but haven't pushed yet are the operator's
  // homework. Waivers signed but not delivered to the owner are the
  // ones to chase the office about. Delivered waivers are clean.
  const openWaiverCount = waivers.filter((w) => w.status === 'DRAFT').length;
  const signedUndelivered = waivers.filter((w) => w.status === 'SIGNED').length;
  const delivered = waivers.filter((w) => w.status === 'DELIVERED').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            &larr; Dashboard
          </Link>
          <PrintButton label="Print snapshot" />
        </div>

        <PageHeader
          title="Cash + bonds command center"
          subtitle="Brook's weekly view. Bonding capacity, retention held by owners, and lien waivers in flight — all on one screen. Tap any tile to drill into the dedicated page."
        />

        {/* ---- Three primary tiles ------------------------------- */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <DeepLinkTile
            href="/bond-capacity"
            heading="Bonding"
            primary={
              bondingConfigured
                ? `${fmtUsd(bondingRollup.availableCents)} available`
                : 'Not configured'
            }
            secondary={
              bondingConfigured
                ? `${fmtUsd(aggregateCapCents)} aggregate cap · ${fmtUsd(singleJobCapCents)} single-job`
                : 'Add surety + capacity in /master-profile to enable'
            }
            tone={bondingConfigured ? 'ready' : 'warn'}
            footer={
              bondingConfigured
                ? `Utilization ${fmtPct(bondingRollup.utilization)}`
                : 'No bonding row on master profile'
            }
          />
          <DeepLinkTile
            href="/retention"
            heading="Retention"
            primary={fmtUsd(retentionRollup.totalHeldCents)}
            secondary={`${retentionRollup.jobsWithRetention} job${retentionRollup.jobsWithRetention === 1 ? '' : 's'} have retention held`}
            tone={
              retentionRollup.totalAccruedInterestCents > 0
                ? 'warn'
                : retentionRollup.totalOutstandingCents > 0
                  ? 'partial'
                  : 'ready'
            }
            footer={
              retentionRollup.totalAccruedInterestCents > 0
                ? `${fmtUsd(retentionRollup.totalAccruedInterestCents)} statutory interest accrued (CA PCC §7107)`
                : retentionRollup.totalOutstandingCents > 0
                  ? `${fmtUsd(retentionRollup.totalOutstandingCents)} outstanding`
                  : 'Nothing past the prompt-pay clock'
            }
          />
          <DeepLinkTile
            href="/lien-waivers"
            heading="Lien waivers"
            primary={`${delivered} delivered · ${signedUndelivered} pending`}
            secondary={`${openWaiverCount} draft${openWaiverCount === 1 ? '' : 's'} to send out`}
            tone={openWaiverCount + signedUndelivered > 0 ? 'partial' : 'ready'}
            footer={
              waivers.length === 0
                ? 'No waivers on file yet'
                : `${waivers.length} total this period`
            }
          />
        </section>

        {/* ---- Bonding banner if exceeded ------------------------ */}
        {bondingRollup.exceeded && (
          <section className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <strong>Bonding capacity exceeded.</strong> Open work + this
            bid&apos;s amount is over the aggregate cap. Open{' '}
            <Link href="/bond-capacity" className="text-red-800 underline">
              /bond-capacity
            </Link>{' '}
            to drop a job or call the surety.
          </section>
        )}

        {/* ---- Retention deep-list ------------------------------- */}
        {retentionStatuses.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 bg-gray-50 px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Jobs holding retention
              </h2>
            </header>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Held</th>
                  <th className="px-3 py-2 text-right">Released</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-right">§7107 interest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retentionStatuses
                  .filter((s) => s.totalRetentionHeldCents > 0)
                  .sort((a, b) => b.outstandingRetentionCents - a.outstandingRetentionCents)
                  .slice(0, 10)
                  .map((s) => (
                    <tr key={s.jobId}>
                      <td className="px-3 py-2 font-mono text-xs">{s.jobId}</td>
                      <td className="px-3 py-2 text-xs">{s.customerName}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {fmtUsd(s.totalRetentionHeldCents)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {fmtUsd(s.totalRetentionReleasedCents)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {fmtUsd(s.outstandingRetentionCents)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          s.ca7107 && s.ca7107.interestCents > 0 ? 'text-amber-700' : ''
                        }`}
                      >
                        {s.ca7107 && s.ca7107.interestCents > 0
                          ? `${fmtUsd(s.ca7107.interestCents)} (+${s.ca7107.daysLate}d)`
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Tiles pull from{' '}
          <code className="rounded bg-gray-100 px-1">/api/master-profile</code>,{' '}
          <code className="rounded bg-gray-100 px-1">/api/ar-invoices</code>,{' '}
          <code className="rounded bg-gray-100 px-1">/api/ar-payments</code>,
          and <code className="rounded bg-gray-100 px-1">/api/lien-waivers</code>.
          Each drill-down stays the canonical edit surface — this page just
          combines them so you don&apos;t have to open three tabs every Friday.
        </p>
      </main>
    </AppShell>
  );
}

function DeepLinkTile({
  href,
  heading,
  primary,
  secondary,
  footer,
  tone,
}: {
  href: string;
  heading: string;
  primary: string;
  secondary: string;
  footer: string;
  tone: 'ready' | 'partial' | 'warn';
}) {
  const cls =
    tone === 'ready'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : tone === 'partial'
        ? 'border-blue-300 bg-blue-50 text-blue-900'
        : 'border-amber-300 bg-amber-50 text-amber-900';
  return (
    <Link
      href={href}
      className={`block rounded-md border p-4 shadow-sm hover:opacity-90 ${cls}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide">
        {heading}
      </div>
      <div className="mt-2 text-xl font-bold">{primary}</div>
      <div className="mt-1 text-xs opacity-80">{secondary}</div>
      <div className="mt-3 text-[11px] opacity-70">{footer}</div>
    </Link>
  );
}
