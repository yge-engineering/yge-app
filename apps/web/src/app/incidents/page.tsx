// /incidents — OSHA 300 incident log.
//
// Plain English: workplace injury + illness record. Federal: 29 CFR
// 1904. CA: T8 §14300. The Form 300A annual summary must be posted
// from Feb 1 through April 30 each year. This page tracks open
// incidents, flags un-reported serious cases, and builds the 300A.

import Link from 'next/link';

import {
  AppShell,
  Card,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  Tile,
} from '../../components';
import {
  computeForm300A,
  computeIncidentRollup,
  incidentClassificationLabel,
  incidentOutcomeLabel,
  isSeriousReportable,
  type Incident,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchIncidents(filter: { logYear?: number; status?: string }): Promise<Incident[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/incidents`);
    if (filter.logYear) url.searchParams.set('logYear', String(filter.logYear));
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { incidents: Incident[] }).incidents;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<Incident[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/incidents`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { incidents: Incident[] }).incidents;
  } catch {
    return [];
  }
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const yearFromParams =
    searchParams.year && /^\d{4}$/.test(searchParams.year)
      ? Number(searchParams.year)
      : new Date().getFullYear();
  const [incidents, all] = await Promise.all([
    fetchIncidents({ logYear: yearFromParams }),
    fetchAll(),
  ]);
  const rollup = computeIncidentRollup(all);
  const summary = computeForm300A(all, yearFromParams);

  // Build year selector based on data.
  const years = Array.from(new Set(all.map((i) => i.logYear)));
  if (!years.includes(yearFromParams)) years.push(yearFromParams);
  years.sort((a, b) => b - a);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="OSHA 300 log"
          subtitle="Workplace injury + illness record. Federal 29 CFR 1904 / CA T8 §14300. Form 300A must be posted Feb 1 – April 30."
          actions={
            <span className="flex gap-2">
              <LinkButton href={`/incidents/300a/${yearFromParams}`} variant="secondary" size="md">
                Print Form 300A
              </LinkButton>
              <LinkButton href="/incidents/new" variant="primary" size="md">
                + Log incident
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={`${yearFromParams} cases`} value={summary.totalCases} />
          <Tile label="Days away (YTD)" value={summary.totalDaysAway} />
          <Tile label="Open" value={rollup.open} />
          <Tile
            label="Unreported serious"
            value={rollup.unreportedSerious}
            tone={rollup.unreportedSerious > 0 ? 'danger' : 'success'}
            warnText={rollup.unreportedSerious > 0 ? 'CalOSHA report due ≤ 8 hr' : undefined}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Year:</span>
          {years.map((y) => (
            <Link
              key={y}
              href={`/incidents?year=${y}`}
              className={`rounded px-2 py-1 text-xs ${y === yearFromParams ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {y}
            </Link>
          ))}
        </section>

        {incidents.length === 0 ? (
          <EmptyState
            title={`No incidents logged for ${yearFromParams}`}
            body="Quiet years are good years. If something happens, log it within 7 days; serious injuries must be CalOSHA-reported within 8 hours."
            actions={[{ href: '/incidents/new', label: 'Log incident', primary: true }]}
          />
        ) : (
          <DataTable
            rows={incidents}
            keyFn={(i) => i.id}
            columns={[
              {
                key: 'case',
                header: 'Case #',
                cell: (i) => (
                  <Link href={`/incidents/${i.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {i.caseNumber}
                  </Link>
                ),
              },
              { key: 'date', header: 'Date', cell: (i) => <span className="font-mono text-xs text-gray-700">{i.incidentDate}</span> },
              {
                key: 'employee',
                header: 'Employee',
                cell: (i) =>
                  i.privacyCase ? <span className="italic text-gray-500">Privacy Case</span> : <span className="text-sm text-gray-900">{i.employeeName}</span>,
              },
              {
                key: 'description',
                header: 'Description',
                cell: (i) => <div className="line-clamp-2 text-xs text-gray-700">{i.description}</div>,
              },
              { key: 'class', header: 'Class.', cell: (i) => <span className="text-xs text-gray-700">{incidentClassificationLabel(i.classification)}</span> },
              { key: 'outcome', header: 'Outcome', cell: (i) => <span className="text-xs text-gray-700">{incidentOutcomeLabel(i.outcome)}</span> },
              {
                key: 'days',
                header: 'Days',
                numeric: true,
                cell: (i) => {
                  const flag = isSeriousReportable(i) && !i.calOshaReported;
                  return (
                    <span className={flag ? 'font-semibold text-red-700' : 'text-xs text-gray-700'}>
                      {i.daysAway > 0 ? `Away: ${i.daysAway}` : ''}
                      {i.daysAway > 0 && i.daysRestricted > 0 ? ' · ' : ''}
                      {i.daysRestricted > 0 ? `Rest: ${i.daysRestricted}` : ''}
                      {i.daysAway === 0 && i.daysRestricted === 0 ? '—' : ''}
                    </span>
                  );
                },
              },
              {
                key: 'actions',
                header: '',
                cell: (i) => (
                  <Link href={`/incidents/${i.id}/301`} className="text-xs text-blue-700 hover:underline">
                    301
                  </Link>
                ),
              },
            ]}
          />
        )}

        <Card className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Form 300A summary — {summary.year}
          </h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <Row label="Total cases" value={summary.totalCases} />
            <Row label="Deaths" value={summary.totalDeaths} />
            <Row label="Days-away cases" value={summary.totalDaysAwayCases} />
            <Row label="Restricted-duty cases" value={summary.totalRestrictedCases} />
            <Row label="Other recordable" value={summary.totalOtherRecordableCases} />
            <Row label="Total days away" value={summary.totalDaysAway} />
            <Row label="Total days restricted" value={summary.totalDaysRestricted} />
          </div>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            By classification
          </h3>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <Row label="Injuries" value={summary.byClassification.injuries} />
            <Row label="Skin disorders" value={summary.byClassification.skinDisorders} />
            <Row label="Respiratory" value={summary.byClassification.respiratoryConditions} />
            <Row label="Poisoning" value={summary.byClassification.poisonings} />
            <Row label="Hearing loss" value={summary.byClassification.hearingLoss} />
            <Row label="Other illnesses" value={summary.byClassification.allOtherIllnesses} />
          </div>
        </Card>
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}
