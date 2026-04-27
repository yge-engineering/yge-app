// /jobs/[id]/binder — single-page aggregate of every record tied to this
// job. The "open the 3-ring" view: AR + AP + change orders + daily
// reports + RFIs + submittals + lien waivers + punch list + dispatches
// + weather + SWPPP, all in summary form with deep links.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  arInvoiceStatusLabel,
  computeArPaymentRollup,
  computeArRollup,
  computeLienWaiverRollup,
  computePunchListRollup,
  computeSwpppRollup,
  computeWeatherLogRollup,
  formatUSD,
  type ApInvoice,
  type ArInvoice,
  type ArPayment,
  type ChangeOrder,
  type DailyReport,
  type Dispatch,
  type Job,
  type LienWaiver,
  type PunchItem,
  type Rfi,
  type Submittal,
  type SwpppInspection,
  type WeatherLog,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, unknown>;
  const arr = body[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
}

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return ((await res.json()) as { job: Job }).job;
}

export default async function JobBinderPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

  // All fetches in parallel; each one filters by jobId client-side.
  const [
    arInvoices,
    arPayments,
    apInvoices,
    changeOrders,
    dailyReports,
    rfis,
    submittals,
    lienWaivers,
    punchItems,
    dispatches,
    weatherLogs,
    swpppInspections,
  ] = await Promise.all([
    fetchJson<ArInvoice>(`/api/ar-invoices?jobId=${encodeURIComponent(job.id)}`, 'invoices'),
    fetchJson<ArPayment>(`/api/ar-payments?jobId=${encodeURIComponent(job.id)}`, 'payments'),
    fetchJson<ApInvoice>(`/api/ap-invoices?jobId=${encodeURIComponent(job.id)}`, 'invoices'),
    fetchJson<ChangeOrder>(`/api/change-orders?jobId=${encodeURIComponent(job.id)}`, 'changeOrders'),
    fetchJson<DailyReport>(`/api/daily-reports?jobId=${encodeURIComponent(job.id)}`, 'reports'),
    fetchJson<Rfi>(`/api/rfis?jobId=${encodeURIComponent(job.id)}`, 'rfis'),
    fetchJson<Submittal>(`/api/submittals?jobId=${encodeURIComponent(job.id)}`, 'submittals'),
    fetchJson<LienWaiver>(`/api/lien-waivers?jobId=${encodeURIComponent(job.id)}`, 'waivers'),
    fetchJson<PunchItem>(`/api/punch-items?jobId=${encodeURIComponent(job.id)}`, 'items'),
    fetchJson<Dispatch>(`/api/dispatches?jobId=${encodeURIComponent(job.id)}`, 'dispatches'),
    fetchJson<WeatherLog>(`/api/weather-logs?jobId=${encodeURIComponent(job.id)}`, 'logs'),
    fetchJson<SwpppInspection>(
      `/api/swppp-inspections?jobId=${encodeURIComponent(job.id)}`,
      'inspections',
    ),
  ]);

  const arRollup = computeArRollup(arInvoices);
  const arPaymentRollup = computeArPaymentRollup(arPayments);
  const lwRollup = computeLienWaiverRollup(lienWaivers);
  const punchRollup = computePunchListRollup(punchItems);
  const wxRollup = computeWeatherLogRollup(weatherLogs);
  const swpppRollup = computeSwpppRollup(swpppInspections);

  // AP totals.
  let apTotalCents = 0;
  for (const ap of apInvoices) {
    if (ap.status === 'APPROVED' || ap.status === 'PAID') apTotalCents += ap.totalCents;
  }
  // CO totals — approved + executed.
  let coTotalCents = 0;
  for (const co of changeOrders) {
    if (co.status === 'APPROVED' || co.status === 'EXECUTED')
      coTotalCents += co.totalCostImpactCents;
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/jobs/${job.id}`} className="text-sm text-yge-blue-500 hover:underline">
          &larr; {job.projectName}
        </Link>
        <span className="text-xs uppercase tracking-wide text-gray-500">Job binder</span>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{job.projectName}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {job.ownerAgency ?? 'Customer TBD'} · {job.id}
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Billed" value={formatUSD(arRollup.paidCents + arRollup.outstandingCents)} />
        <Stat label="Collected" value={formatUSD(arPaymentRollup.totalCents)} />
        <Stat label="Costs (AP)" value={formatUSD(apTotalCents)} />
        <Stat label="CO total" value={formatUSD(coTotalCents)} />
      </section>

      <SectionPanel
        title="AR Invoices"
        count={arInvoices.length}
        href={`/ar-invoices?jobId=${encodeURIComponent(job.id)}`}
        empty={arInvoices.length === 0}
      >
        {arInvoices.slice(0, 5).map((i) => (
          <Row
            key={i.id}
            href={`/ar-invoices/${i.id}`}
            primary={`#${i.invoiceNumber} · ${i.invoiceDate}`}
            secondary={arInvoiceStatusLabel(i.status)}
            value={formatUSD(i.totalCents)}
          />
        ))}
        {arInvoices.length > 5 && (
          <MoreLink count={arInvoices.length - 5} href={`/ar-invoices?jobId=${encodeURIComponent(job.id)}`} />
        )}
      </SectionPanel>

      <SectionPanel
        title="Customer Payments"
        count={arPayments.length}
        href={`/ar-payments?jobId=${encodeURIComponent(job.id)}`}
        empty={arPayments.length === 0}
      >
        {arPayments.slice(0, 5).map((p) => (
          <Row
            key={p.id}
            href={`/ar-payments/${p.id}`}
            primary={p.receivedOn}
            secondary={`${p.kind} · ${p.method}${p.referenceNumber ? ' · ' + p.referenceNumber : ''}`}
            value={formatUSD(p.amountCents)}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="AP Invoices (job costs)"
        count={apInvoices.length}
        href={`/ap-invoices?jobId=${encodeURIComponent(job.id)}`}
        empty={apInvoices.length === 0}
      >
        {apInvoices.slice(0, 5).map((ap) => (
          <Row
            key={ap.id}
            href={`/ap-invoices/${ap.id}`}
            primary={`${ap.vendorName}${ap.invoiceNumber ? ' · ' + ap.invoiceNumber : ''}`}
            secondary={`${ap.invoiceDate} · ${ap.status}`}
            value={formatUSD(ap.totalCents)}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Change Orders"
        count={changeOrders.length}
        href={`/change-orders?jobId=${encodeURIComponent(job.id)}`}
        empty={changeOrders.length === 0}
      >
        {changeOrders.slice(0, 5).map((co) => (
          <Row
            key={co.id}
            href={`/change-orders/${co.id}`}
            primary={`#${co.changeOrderNumber} · ${co.subject}`}
            secondary={co.status}
            value={formatUSD(co.totalCostImpactCents)}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Daily Reports"
        count={dailyReports.length}
        href={`/daily-reports?jobId=${encodeURIComponent(job.id)}`}
        empty={dailyReports.length === 0}
      >
        {dailyReports.slice(0, 5).map((dr) => (
          <Row
            key={dr.id}
            href={`/daily-reports/${dr.id}`}
            primary={dr.date}
            secondary={`${dr.crewOnSite.length} crew${dr.scopeCompleted ? ' · scope logged' : ''}`}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="RFIs"
        count={rfis.length}
        href={`/rfis?jobId=${encodeURIComponent(job.id)}`}
        empty={rfis.length === 0}
      >
        {rfis.slice(0, 5).map((r) => (
          <Row
            key={r.id}
            href={`/rfis/${r.id}`}
            primary={`#${r.rfiNumber} · ${r.subject}`}
            secondary={`${r.status} · sent ${r.sentAt ?? '—'}`}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Submittals"
        count={submittals.length}
        href={`/submittals?jobId=${encodeURIComponent(job.id)}`}
        empty={submittals.length === 0}
      >
        {submittals.slice(0, 5).map((s) => (
          <Row
            key={s.id}
            href={`/submittals/${s.id}`}
            primary={`#${s.submittalNumber} · ${s.subject}`}
            secondary={s.status}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Lien Waivers"
        count={lienWaivers.length}
        href={`/lien-waivers?jobId=${encodeURIComponent(job.id)}`}
        empty={lienWaivers.length === 0}
        warningCount={lwRollup.unsignedUnconditional}
        warningLabel="unsigned uncond."
      >
        {lienWaivers.slice(0, 5).map((w) => (
          <Row
            key={w.id}
            href={`/lien-waivers/${w.id}`}
            primary={`through ${w.throughDate}`}
            secondary={`${w.kind} · ${w.status}`}
            value={formatUSD(w.paymentAmountCents)}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Punch List"
        count={punchItems.length}
        href={`/punch-list?jobId=${encodeURIComponent(job.id)}`}
        empty={punchItems.length === 0}
        warningCount={punchRollup.openSafety + punchRollup.overdue}
        warningLabel={
          punchRollup.openSafety > 0 ? 'open safety / overdue' : 'overdue'
        }
      >
        {punchItems.slice(0, 5).map((p) => (
          <Row
            key={p.id}
            href={`/punch-list/${p.id}`}
            primary={p.location}
            secondary={`${p.severity} · ${p.status}${p.dueOn ? ' · due ' + p.dueOn : ''}`}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Dispatches"
        count={dispatches.length}
        href={`/dispatch?jobId=${encodeURIComponent(job.id)}`}
        empty={dispatches.length === 0}
      >
        {dispatches.slice(0, 5).map((d) => (
          <Row
            key={d.id}
            href={`/dispatch/${d.id}`}
            primary={`${d.scheduledFor} · ${d.foremanName}`}
            secondary={`${d.crew.length} crew · ${d.equipment.length} equip · ${d.status}`}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="Weather Log"
        count={weatherLogs.length}
        href={`/weather?jobId=${encodeURIComponent(job.id)}`}
        empty={weatherLogs.length === 0}
        warningCount={wxRollup.heatComplianceGaps}
        warningLabel="§3395 gaps"
      >
        {weatherLogs.slice(0, 5).map((w) => (
          <Row
            key={w.id}
            href={`/weather/${w.id}`}
            primary={w.observedOn}
            secondary={`${w.primaryCondition}${w.highF != null ? ' · ' + w.highF + '°F' : ''} · ${w.impact}`}
          />
        ))}
      </SectionPanel>

      <SectionPanel
        title="SWPPP Inspections"
        count={swpppInspections.length}
        href={`/swppp?jobId=${encodeURIComponent(job.id)}`}
        empty={swpppInspections.length === 0}
        warningCount={swpppRollup.openDeficiencies}
        warningLabel="open deficiencies"
      >
        {swpppInspections.slice(0, 5).map((s) => (
          <Row
            key={s.id}
            href={`/swppp/${s.id}`}
            primary={s.inspectedOn}
            secondary={`${s.trigger} · ${s.bmpChecks.length} BMPs`}
          />
        ))}
      </SectionPanel>
    </main>
  );
}

function SectionPanel({
  title,
  count,
  href,
  empty,
  warningCount,
  warningLabel,
  children,
}: {
  title: string;
  count: number;
  href: string;
  empty: boolean;
  warningCount?: number;
  warningLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title} <span className="text-gray-400">({count})</span>
        </h2>
        <div className="flex items-center gap-3">
          {warningCount != null && warningCount > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
              {warningCount} {warningLabel}
            </span>
          )}
          <Link href={href} className="text-xs text-yge-blue-500 hover:underline">
            Open all &rarr;
          </Link>
        </div>
      </div>
      {empty ? (
        <p className="text-xs text-gray-400">None yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">{children}</div>
      )}
    </section>
  );
}

function Row({
  href,
  primary,
  secondary,
  value,
}: {
  href: string;
  primary: string;
  secondary?: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900">{primary}</div>
        {secondary && (
          <div className="truncate text-xs text-gray-500">{secondary}</div>
        )}
      </div>
      {value && <div className="font-mono text-sm text-gray-700">{value}</div>}
    </Link>
  );
}

function MoreLink({ count, href }: { count: number; href: string }) {
  return (
    <Link
      href={href}
      className="block py-2 text-center text-xs text-yge-blue-500 hover:underline"
    >
      + {count} more
    </Link>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
