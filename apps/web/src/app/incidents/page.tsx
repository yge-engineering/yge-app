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
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();
  years.sort((a, b) => b - a);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('incidents.title')}
          subtitle={t('incidents.subtitle')}
          actions={
            <span className="flex gap-2">
              <LinkButton href={`/incidents/300a/${yearFromParams}`} variant="secondary" size="md">
                {t('incidents.printForm300a')}
              </LinkButton>
              <LinkButton href="/incidents/new" variant="primary" size="md">
                {t('incidents.logIncident')}
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('incidents.tile.cases', { year: yearFromParams })} value={summary.totalCases} />
          <Tile label={t('incidents.tile.daysAway')} value={summary.totalDaysAway} />
          <Tile label={t('incidents.tile.open')} value={rollup.open} />
          <Tile
            label={t('incidents.tile.unreportedSerious')}
            value={rollup.unreportedSerious}
            tone={rollup.unreportedSerious > 0 ? 'danger' : 'success'}
            warnText={rollup.unreportedSerious > 0 ? t('incidents.tile.unreportedSerious.warn') : undefined}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('incidents.year.label')}</span>
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
            title={t('incidents.empty.title', { year: yearFromParams })}
            body={t('incidents.empty.body')}
            actions={[{ href: '/incidents/new', label: t('incidents.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={incidents}
            keyFn={(i) => i.id}
            columns={[
              {
                key: 'case',
                header: t('incidents.col.case'),
                cell: (i) => (
                  <Link href={`/incidents/${i.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {i.caseNumber}
                  </Link>
                ),
              },
              { key: 'date', header: t('incidents.col.date'), cell: (i) => <span className="font-mono text-xs text-gray-700">{i.incidentDate}</span> },
              {
                key: 'employee',
                header: t('incidents.col.employee'),
                cell: (i) =>
                  i.privacyCase ? <span className="italic text-gray-500">{t('incidents.col.privacyCase')}</span> : <span className="text-sm text-gray-900">{i.employeeName}</span>,
              },
              {
                key: 'description',
                header: t('incidents.col.description'),
                cell: (i) => <div className="line-clamp-2 text-xs text-gray-700">{i.description}</div>,
              },
              { key: 'class', header: t('incidents.col.classification'), cell: (i) => <span className="text-xs text-gray-700">{incidentClassificationLabel(i.classification)}</span> },
              { key: 'outcome', header: t('incidents.col.outcome'), cell: (i) => <span className="text-xs text-gray-700">{incidentOutcomeLabel(i.outcome)}</span> },
              {
                key: 'days',
                header: t('incidents.col.days'),
                numeric: true,
                cell: (i) => {
                  const flag = isSeriousReportable(i) && !i.calOshaReported;
                  return (
                    <span className={flag ? 'font-semibold text-red-700' : 'text-xs text-gray-700'}>
                      {i.daysAway > 0 ? t('incidents.col.daysAway', { n: i.daysAway }) : ''}
                      {i.daysAway > 0 && i.daysRestricted > 0 ? ' · ' : ''}
                      {i.daysRestricted > 0 ? t('incidents.col.daysRestricted', { n: i.daysRestricted }) : ''}
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
                    {t('incidents.action.301')}
                  </Link>
                ),
              },
            ]}
          />
        )}

        <Card className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('incidents.summary.title', { year: summary.year })}
          </h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <Row label={t('incidents.summary.totalCases')} value={summary.totalCases} />
            <Row label={t('incidents.summary.deaths')} value={summary.totalDeaths} />
            <Row label={t('incidents.summary.daysAwayCases')} value={summary.totalDaysAwayCases} />
            <Row label={t('incidents.summary.restrictedCases')} value={summary.totalRestrictedCases} />
            <Row label={t('incidents.summary.otherRecordable')} value={summary.totalOtherRecordableCases} />
            <Row label={t('incidents.summary.totalDaysAway')} value={summary.totalDaysAway} />
            <Row label={t('incidents.summary.totalDaysRestricted')} value={summary.totalDaysRestricted} />
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
