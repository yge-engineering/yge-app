// /swppp — SWPPP / BMP inspection log.
//
// Plain English: Stormwater Pollution Prevention Plan / Best
// Management Practices inspections required under the California
// Construction General Permit. The State Water Resources Control
// Board can audit at any time. Page tracks cadence and surfaces any
// open deficiencies.

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
  computeSwpppRollup,
  deficiencyCount,
  openDeficiencyCount,
  swpppTriggerLabel,
  type SwpppInspection,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspections(filter: { jobId?: string }): Promise<SwpppInspection[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/swppp-inspections`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { inspections: SwpppInspection[] }).inspections;
  } catch {
    return [];
  }
}

export default async function SwpppPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const inspections = await fetchInspections(searchParams);
  const rollup = computeSwpppRollup(inspections);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="SWPPP inspections"
          subtitle="Stormwater Pollution Prevention Plan / BMP inspections per the CA Construction General Permit. Audited by the State Water Resources Control Board."
          actions={
            <LinkButton href="/swppp/new" variant="primary" size="md">
              + New inspection
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile
            label="With deficiencies"
            value={rollup.withDeficiencies}
            tone={rollup.withDeficiencies > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Open deficiencies"
            value={rollup.openDeficiencies}
            tone={rollup.openDeficiencies > 0 ? 'danger' : 'success'}
          />
          <Tile
            label="Days since last"
            value={rollup.daysSinceLast ?? '—'}
            tone={rollup.weeklyCadenceLate ? 'danger' : 'success'}
          />
        </section>

        {rollup.weeklyCadenceLate ? (
          <Card className="mb-4 border-red-300 bg-red-50">
            <p className="text-sm text-red-900">
              <strong>Weekly cadence missed:</strong> {rollup.daysSinceLast} days since
              last inspection ({rollup.lastInspectedOn}). The CGP requires at least
              weekly inspections during the rainy season.
            </p>
          </Card>
        ) : null}

        {inspections.length === 0 ? (
          <EmptyState
            title="No SWPPP inspections yet"
            body="Stormwater inspections protect us against fines and stop-work orders. Log them on a weekly cadence in the rainy season."
            actions={[{ href: '/swppp/new', label: 'New inspection', primary: true }]}
          />
        ) : (
          <DataTable
            rows={inspections}
            keyFn={(s) => s.id}
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (s) => (
                  <Link href={`/swppp/${s.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {s.inspectedOn}
                  </Link>
                ),
              },
              { key: 'trigger', header: 'Trigger', cell: (s) => <span className="text-xs text-gray-700">{swpppTriggerLabel(s.trigger)}</span> },
              {
                key: 'inspector',
                header: 'Inspector',
                cell: (s) => (
                  <span className="text-xs text-gray-700">
                    {s.inspectorName}
                    {s.inspectorCertification ? <div className="text-[10px] text-gray-500">QSP/QSD #{s.inspectorCertification}</div> : null}
                  </span>
                ),
              },
              {
                key: 'job',
                header: 'Job',
                cell: (s) => (
                  <Link href={`/jobs/${s.jobId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {s.jobId}
                  </Link>
                ),
              },
              { key: 'bmps', header: 'BMPs', numeric: true, cell: (s) => <span className="font-mono text-xs">{s.bmpChecks.length}</span> },
              {
                key: 'deficient',
                header: 'Deficient',
                numeric: true,
                cell: (s) => {
                  const def = deficiencyCount(s);
                  return def > 0 ? (
                    <span className="font-mono text-xs font-semibold text-amber-800">{def}</span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400">0</span>
                  );
                },
              },
              {
                key: 'open',
                header: 'Open',
                numeric: true,
                cell: (s) => {
                  const open = openDeficiencyCount(s);
                  return open > 0 ? (
                    <span className="font-mono text-xs font-semibold text-red-700">{open}</span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400">0</span>
                  );
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
