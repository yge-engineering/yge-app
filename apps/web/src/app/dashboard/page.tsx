// /dashboard — morning glance.
//
// Replaces the placeholder card grid with a live tile board: today's
// dispatch, cash position, open items, compliance flags. The first
// page Brook + Ryan should look at every morning.

import Link from 'next/link';
import {
  computeArPaymentRollup,
  computeArRollup,
  computeDispatchRollup,
  computeLienWaiverRollup,
  computePunchListRollup,
  computeSwpppRollup,
  computeWeatherLogRollup,
  detectDoubleBookings,
  formatUSD,
  type ApInvoice,
  type ArInvoice,
  type ArPayment,
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

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [
    jobs,
    arInvoices,
    arPayments,
    apInvoices,
    rfis,
    submittals,
    lienWaivers,
    punchItems,
    dispatches,
    weatherLogs,
    swpppInspections,
  ] = await Promise.all([
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ArPayment>('/api/ar-payments', 'payments'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<Rfi>('/api/rfis', 'rfis'),
    fetchJson<Submittal>('/api/submittals', 'submittals'),
    fetchJson<LienWaiver>('/api/lien-waivers', 'waivers'),
    fetchJson<PunchItem>('/api/punch-items', 'items'),
    fetchJson<Dispatch>('/api/dispatches', 'dispatches'),
    fetchJson<WeatherLog>('/api/weather-logs', 'logs'),
    fetchJson<SwpppInspection>('/api/swppp-inspections', 'inspections'),
  ]);

  const arRollup = computeArRollup(arInvoices);
  const arPaymentRollup = computeArPaymentRollup(arPayments);
  const dispatchRollup = computeDispatchRollup(dispatches, today);
  const todayDoubleBookings = detectDoubleBookings(dispatches).filter(
    (db) => db.scheduledFor === today,
  );
  const lwRollup = computeLienWaiverRollup(lienWaivers);
  const punchRollup = computePunchListRollup(punchItems);
  const wxRollup = computeWeatherLogRollup(weatherLogs);
  const swpppRollup = computeSwpppRollup(swpppInspections);

  // AP unpaid total (approved but not yet paid).
  let apUnpaidCents = 0;
  let apUnpaidCount = 0;
  for (const ap of apInvoices) {
    if (ap.status === 'APPROVED') {
      apUnpaidCents += Math.max(0, ap.totalCents - ap.paidCents);
      apUnpaidCount += 1;
    }
  }

  // Open RFIs + submittals.
  const openRfis = rfis.filter(
    (r) => r.status === 'DRAFT' || r.status === 'SENT',
  ).length;
  const openSubmittals = submittals.filter(
    (s) =>
      s.status === 'DRAFT' ||
      s.status === 'SUBMITTED' ||
      s.status === 'REVISE_RESUBMIT',
  ).length;

  const activeJobs = jobs.filter(
    (j) => j.status === 'AWARDED' || j.status === 'PURSUING',
  ).length;

  const todayDispatches = dispatches.filter(
    (d) => d.scheduledFor === today && d.status !== 'CANCELLED',
  );

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-yge-blue-500">Good morning</h1>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {activeJobs} active jobs
          </p>
        </div>
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          All modules &rarr;
        </Link>
      </header>

      {/* COMPLIANCE BAR — anything that's actively a problem */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ComplianceTile
          label="§3395 heat gaps"
          value={wxRollup.heatComplianceGaps}
          severity={wxRollup.heatComplianceGaps > 0 ? 'bad' : 'ok'}
          href="/weather"
          ok="No gaps"
        />
        <ComplianceTile
          label="SWPPP open deficiencies"
          value={swpppRollup.openDeficiencies}
          severity={swpppRollup.openDeficiencies > 0 ? 'bad' : 'ok'}
          href="/swppp"
          ok="No open BMP issues"
        />
        <ComplianceTile
          label="Punch — open safety"
          value={punchRollup.openSafety}
          severity={punchRollup.openSafety > 0 ? 'bad' : 'ok'}
          href="/punch-list"
          ok="No safety items open"
        />
        <ComplianceTile
          label="Today's dispatch conflicts"
          value={todayDoubleBookings.length}
          severity={todayDoubleBookings.length > 0 ? 'bad' : 'ok'}
          href={`/dispatch?scheduledFor=${today}`}
          ok="No double-bookings"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* TODAY'S DISPATCH */}
        <section className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title="Today's dispatch" href={`/dispatch?scheduledFor=${today}`} />
          {todayDispatches.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nothing on the board for today.{' '}
              <Link href="/dispatch/new" className="text-yge-blue-500 hover:underline">
                Add a dispatch &rarr;
              </Link>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {todayDispatches.slice(0, 6).map((d) => (
                <Link
                  key={d.id}
                  href={`/dispatch/${d.id}`}
                  className="block rounded border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <div className="text-xs text-gray-500">{d.scheduledFor}</div>
                  <div className="text-sm font-medium text-gray-900 line-clamp-1">
                    {d.foremanName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {d.crew.length} crew · {d.equipment.length} equip ·{' '}
                    {d.status.toLowerCase()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* CASH POSITION */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title="Cash position" href="/wip" />
          <KvRow label="AR outstanding" value={formatUSD(arRollup.outstandingCents)} />
          <KvRow
            label="Collected (lifetime)"
            value={formatUSD(arPaymentRollup.totalCents)}
          />
          <KvRow
            label="AP unpaid"
            value={`${apUnpaidCount} · ${formatUSD(apUnpaidCents)}`}
            warn={apUnpaidCents > 0}
          />
          <KvRow
            label="Retention released"
            value={formatUSD(arPaymentRollup.retentionReleaseCents)}
          />
        </section>

        {/* OPEN ITEMS */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title="Open items" />
          <KvRow label="Open RFIs" value={openRfis} link="/rfis" />
          <KvRow label="Open submittals" value={openSubmittals} link="/submittals" />
          <KvRow
            label="Open punch items"
            value={punchRollup.open + punchRollup.inProgress}
            link="/punch-list"
            warn={punchRollup.overdue > 0}
            warnText={
              punchRollup.overdue > 0 ? `${punchRollup.overdue} overdue` : undefined
            }
          />
          <KvRow
            label="Unsigned uncond. waivers"
            value={lwRollup.unsignedUnconditional}
            link="/lien-waivers"
            warn={lwRollup.unsignedUnconditional > 0}
            warnText={
              lwRollup.unsignedUnconditional > 0
                ? "don't sign uncond. before funds clear"
                : undefined
            }
          />
        </section>

        {/* CREWS TODAY */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <CardHeader title="Crews on today" />
          <KvRow label="Today jobs" value={dispatchRollup.todayCount} />
          <KvRow label="Crew headcount" value={dispatchRollup.todayCrewHeadcount} />
          <KvRow label="Equipment out" value={dispatchRollup.todayEquipmentCount} />
        </section>

        {/* QUICK ACTIONS */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <CardHeader title="Quick actions" />
          <div className="grid gap-2 sm:grid-cols-3">
            <QuickLink href="/dispatch/new" label="New dispatch" />
            <QuickLink href="/daily-reports/new" label="Daily report" />
            <QuickLink href="/toolbox-talks/new" label="Toolbox talk" />
            <QuickLink href="/swppp/new" label="SWPPP inspection" />
            <QuickLink href="/weather/new" label="Log weather" />
            <QuickLink href="/incidents/new" label="Log incident" />
            <QuickLink href="/ar-payments/new" label="Record payment" />
            <QuickLink href="/pcos/new" label="New PCO" />
            <QuickLink href="/rfis/new" label="New RFI" />
          </div>
        </section>
      </div>
    </main>
  );
}

function CardHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-yge-blue-500 hover:underline">
          Open &rarr;
        </Link>
      )}
    </div>
  );
}

function KvRow({
  label,
  value,
  link,
  warn,
  warnText,
}: {
  label: string;
  value: string | number;
  link?: string;
  warn?: boolean;
  warnText?: string;
}) {
  const inner = (
    <div
      className={`flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-b-0 ${
        warn ? 'text-red-700' : ''
      }`}
    >
      <div>
        <span className={warn ? 'font-semibold' : 'text-gray-700'}>{label}</span>
        {warnText && <div className="text-xs text-red-600">{warnText}</div>}
      </div>
      <span
        className={`font-mono ${warn ? 'font-bold' : 'font-semibold text-gray-900'}`}
      >
        {value}
      </span>
    </div>
  );
  return link ? (
    <Link href={link} className="block hover:bg-gray-50">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ComplianceTile({
  label,
  value,
  severity,
  href,
  ok,
}: {
  label: string;
  value: number;
  severity: 'ok' | 'warn' | 'bad';
  href: string;
  ok: string;
}) {
  const cls =
    severity === 'bad'
      ? 'border-red-300 bg-red-50 text-red-900'
      : severity === 'warn'
        ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
        : 'border-green-300 bg-green-50 text-green-900';
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-3 shadow-sm hover:opacity-90 ${cls}`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      {value > 0 ? (
        <div className="mt-1 text-2xl font-bold">{value}</div>
      ) : (
        <div className="mt-1 text-sm font-medium opacity-80">{ok}</div>
      )}
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded border border-yge-blue-500 px-3 py-2 text-center text-sm text-yge-blue-500 hover:bg-yge-blue-50"
    >
      {label}
    </Link>
  );
}
