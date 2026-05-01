// /incidents — OSHA 300 incident log.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  computeForm300A,
  computeIncidentRollup,
  incidentClassificationLabel,
  incidentOutcomeLabel,
  incidentStatusLabel,
  isSeriousReportable,
  type Incident,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchIncidents(filter: { logYear?: number; status?: string }): Promise<Incident[]> {
  const url = new URL(`${apiBaseUrl()}/api/incidents`);
  if (filter.logYear) url.searchParams.set('logYear', String(filter.logYear));
  if (filter.status) url.searchParams.set('status', filter.status);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { incidents: Incident[] }).incidents;
}
async function fetchAll(): Promise<Incident[]> {
  const res = await fetch(`${apiBaseUrl()}/api/incidents`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { incidents: Incident[] }).incidents;
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
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/incidents/300a/${yearFromParams}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Print Form 300A
          </Link>
          <Link
            href="/incidents/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Log incident
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">OSHA 300 Log</h1>
      <p className="mt-2 text-gray-700">
        Workplace injury + illness record. Federal: 29 CFR 1904. CA: T8 §14300.
        Form 300A annual summary must be posted Feb 1 - April 30.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label={`${yearFromParams} cases`} value={summary.totalCases} />
        <Stat label="Days away (YTD)" value={summary.totalDaysAway} />
        <Stat label="Open" value={rollup.open} />
        <Stat
          label="Unreported serious"
          value={rollup.unreportedSerious}
          variant={rollup.unreportedSerious > 0 ? 'bad' : 'ok'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Year:</span>
        {years.map((y) => (
          <Link
            key={y}
            href={`/incidents?year=${y}`}
            className={`rounded px-2 py-1 text-xs ${y === yearFromParams ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {y}
          </Link>
        ))}
      </section>

      {incidents.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No incidents logged for {yearFromParams}.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Case #</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Classification</th>
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2 text-right">Days</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incidents.map((i) => {
                const flag = isSeriousReportable(i) && !i.calOshaReported;
                return (
                  <tr key={i.id} className={flag ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {i.caseNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {i.incidentDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {i.privacyCase ? (
                        <span className="italic text-gray-500">Privacy Case</span>
                      ) : (
                        i.employeeName
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div className="line-clamp-2">{i.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {incidentClassificationLabel(i.classification)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {incidentOutcomeLabel(i.outcome)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-700">
                      {i.daysAway > 0 && <div>Away: {i.daysAway}</div>}
                      {i.daysRestricted > 0 && <div>Rest: {i.daysRestricted}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/incidents/${i.id}`} className="text-yge-blue-500 hover:underline">
                        Open
                      </Link>
                      {' · '}
                      <Link href={`/incidents/${i.id}/301`} className="text-yge-blue-500 hover:underline">
                        301
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Form300ASummary summary={summary} />
    </main>
    </AppShell>
  );
}

function Form300ASummary({
  summary,
}: {
  summary: ReturnType<typeof computeForm300A>;
}) {
  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
    </section>
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

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
