// /osha-300 — Cal/OSHA Form 300 log + Form 300A annual summary for the
// requested log year. Pull every incident, run it through the shared helper,
// render the per-case log + summary tiles + CSV download.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { requirePermission } from '../../lib/permissions';
import {
  buildOsha300ASummary,
  buildOsha300Rows,
  osha300CsvRows,
  type Incident,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/incidents`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { incidents: Incident[] }).incidents;
  } catch {
    return [];
  }
}

const YEARS = [0, 1, 2, 3, 4].map((delta) => new Date().getFullYear() - delta);

export default async function Osha300Page({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  requirePermission('safety:view');

  const yearParam = searchParams.year ? parseInt(searchParams.year, 10) : NaN;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();

  const incidents = await fetchIncidents();
  const rows = buildOsha300Rows(incidents, year);
  const summary = buildOsha300ASummary(incidents, year);
  const csv = osha300CsvRows(rows);
  const tableRows = rows.map((r) => ({ ...r, id: r.caseNumber }));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={`Cal/OSHA 300 log — ${year}`}
          subtitle="Per-case log of recordable injuries / illnesses plus the 300A annual summary. Privacy-case names are masked per §1904.29(b)(7)."
          actions={
            <span className="flex gap-2">
              <StatementCsvButton
                filename={`osha-300-${year}.csv`}
                headers={csv.headers}
                rows={csv.rows}
              />
            </span>
          }
        />

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Log year</span>
          {YEARS.map((y) => (
            <Link
              key={y}
              href={`/osha-300?year=${y}`}
              className={`rounded px-2 py-1 text-xs ${y === year ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {y}
            </Link>
          ))}
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total cases" value={summary.totalCases} />
          <Tile
            label="Deaths"
            value={summary.byOutcome.DEATH}
            tone={summary.byOutcome.DEATH > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Days away"
            value={summary.totalDaysAway}
            tone={summary.totalDaysAway > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Days restricted"
            value={summary.totalDaysRestricted}
            tone={summary.totalDaysRestricted > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              By outcome (cols G–J)
            </div>
            <ul className="space-y-1 text-sm">
              {(['DEATH', 'DAYS_AWAY', 'JOB_TRANSFER_OR_RESTRICTION', 'OTHER_RECORDABLE'] as const).map(
                (k) => (
                  <li key={k} className="flex items-center justify-between">
                    <span className="text-gray-700">{k.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="font-mono font-semibold">{summary.byOutcome[k]}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              By classification (cols M(1)–M(6))
            </div>
            <ul className="space-y-1 text-sm">
              {(
                [
                  'INJURY',
                  'SKIN_DISORDER',
                  'RESPIRATORY',
                  'POISONING',
                  'HEARING_LOSS',
                  'OTHER_ILLNESS',
                ] as const
              ).map((k) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-gray-700">{k.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="font-mono font-semibold">{summary.byClassification[k]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {tableRows.length === 0 ? (
          <EmptyState
            title="No recordable cases for this year"
            body="Add an incident via the field app or /incidents/new, and it'll show up here."
          />
        ) : (
          <DataTable
            rows={tableRows}
            columns={[
              {
                key: 'caseNumber',
                header: 'Case #',
                cell: (r) => <span className="font-mono text-xs">{r.caseNumber}</span>,
              },
              { key: 'date', header: 'Date', cell: (r) => <span className="font-mono text-xs">{r.incidentDate}</span> },
              { key: 'employee', header: 'Employee', cell: (r) => <span className="text-sm">{r.employeeName}</span> },
              { key: 'job', header: 'Job title', cell: (r) => <span className="text-xs text-gray-600">{r.jobTitle || '—'}</span> },
              { key: 'where', header: 'Where', cell: (r) => <span className="text-xs">{r.location}</span> },
              {
                key: 'desc',
                header: 'Description',
                cell: (r) => <span className="line-clamp-2 text-xs text-gray-700">{r.description}</span>,
              },
              {
                key: 'class',
                header: 'Class',
                cell: (r) => <span className="text-[10px] uppercase text-gray-600">{r.classification.replace(/_/g, ' ')}</span>,
              },
              {
                key: 'outcome',
                header: 'Outcome',
                cell: (r) =>
                  r.outcome === 'DEATH' ? (
                    <StatusPill label="Death" tone="danger" />
                  ) : r.outcome === 'DAYS_AWAY' ? (
                    <StatusPill label="Days away" tone="warn" />
                  ) : r.outcome === 'JOB_TRANSFER_OR_RESTRICTION' ? (
                    <StatusPill label="Restricted" tone="warn" />
                  ) : (
                    <StatusPill label="Other recordable" tone="neutral" />
                  ),
              },
              { key: 'daysAway', header: 'Days away', numeric: true, cell: (r) => <span>{r.daysAway}</span> },
              { key: 'daysRest', header: 'Days restr.', numeric: true, cell: (r) => <span>{r.daysRestricted}</span> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
