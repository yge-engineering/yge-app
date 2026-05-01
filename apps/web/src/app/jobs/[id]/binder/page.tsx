// /jobs/[id]/binder — single-page aggregate of every record tied to
// this job. The "open the 3-ring" view: AR + AP + change orders +
// daily reports + RFIs + submittals + lien waivers + punch list +
// dispatches + weather + SWPPP, all in summary form with deep links.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type React from 'react';

import {
  AppShell,
  Money,
  PageHeader,
  Tile,
} from '../../../../components';
import {
  arInvoiceStatusLabel,
  computeArPaymentRollup,
  computeArRollup,
  computeLienWaiverRollup,
  computePunchListRollup,
  computeSwpppRollup,
  computeWeatherLogRollup,
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
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch { return []; }
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { job: Job }).job;
  } catch { return null; }
}

export default async function JobBinderPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

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

  let apTotalCents = 0;
  for (const ap of apInvoices) {
    if (ap.status === 'APPROVED' || ap.status === 'PAID') apTotalCents += ap.totalCents;
  }
  let coTotalCents = 0;
  for (const co of changeOrders) {
    if (co.status === 'APPROVED' || co.status === 'EXECUTED')
      coTotalCents += co.totalCostImpactCents;
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={job.projectName}
          subtitle={`${job.ownerAgency ?? 'Customer TBD'} · ${job.id}`}
          back={{ href: `/jobs/${job.id}`, label: `← ${job.projectName}` }}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Billed" value={<Money cents={arRollup.paidCents + arRollup.outstandingCents} />} />
          <Tile label="Collected" value={<Money cents={arPaymentRollup.totalCents} />} />
          <Tile label="Costs (AP)" value={<Money cents={apTotalCents} />} />
          <Tile label="CO total" value={<Money cents={coTotalCents} />} />
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
              value={<Money cents={i.totalCents} />}
            />
          ))}
          {arInvoices.length > 5 ? (
            <MoreLink count={arInvoices.length - 5} href={`/ar-invoices?jobId=${encodeURIComponent(job.id)}`} />
          ) : null}
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
              value={<Money cents={p.amountCents} />}
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
              value={<Money cents={ap.totalCents} />}
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
              value={<Money cents={co.totalCostImpactCents} />}
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
              value={<Money cents={w.paymentAmountCents} />}
            />
          ))}
        </SectionPanel>

        <SectionPanel
          title="Punch List"
          count={punchItems.length}
          href={`/punch-list?jobId=${encodeURIComponent(job.id)}`}
          empty={punchItems.length === 0}
          warningCount={punchRollup.openSafety + punchRollup.overdue}
          warningLabel={punchRollup.openSafety > 0 ? 'open safety / overdue' : 'overdue'}
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
    </AppShell>
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
    <section className="mt-6 rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title} <span className="text-gray-400">({count})</span>
        </h2>
        <div className="flex items-center gap-3">
          {warningCount != null && warningCount > 0 ? (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">
              {warningCount} {warningLabel}
            </span>
          ) : null}
          <Link href={href} className="text-xs text-blue-700 hover:underline">
            Open all →
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
  /** Right-side value — typically a <Money /> component. */
  value?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900">{primary}</div>
        {secondary ? <div className="truncate text-xs text-gray-500">{secondary}</div> : null}
      </div>
      {value ? <div className="text-sm text-gray-700">{value}</div> : null}
    </Link>
  );
}

function MoreLink({ count, href }: { count: number; href: string }) {
  return (
    <Link
      href={href}
      className="block py-2 text-center text-xs text-blue-700 hover:underline"
    >
      + {count} more
    </Link>
  );
}
