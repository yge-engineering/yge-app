// /jsas — Job Safety Analysis list view.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { requirePermission } from '../../lib/permissions';
import {
  hasHighSeverityHazard,
  jsaTaskTypeLabel,
  uncontrolledHazardCount,
  type Jsa,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJsas(): Promise<Jsa[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jsas`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jsas: Jsa[] }).jsas;
  } catch {
    return [];
  }
}

export default async function JsasPage() {
  requirePermission('safety:view');
  const jsas = await fetchJsas();

  const year = new Date().getFullYear().toString();
  const thisYear = jsas.filter((j) => j.workDate.startsWith(year));
  const highSeverityCount = jsas.filter((j) => hasHighSeverityHazard(j)).length;
  const uncontrolledCount = jsas.filter((j) => uncontrolledHazardCount(j) > 0).length;

  const csvRows: Array<Array<string | number>> = jsas.map((j) => [
    j.workDate,
    j.jobId,
    jsaTaskTypeLabel(j.taskType),
    j.preparedByName,
    j.hazards.length,
    uncontrolledHazardCount(j),
    j.crewSignatures.length,
    hasHighSeverityHazard(j) ? 'Y' : 'N',
  ]);

  const tableRows = jsas.map((j) => ({
    ...j,
    deficiencyCount: uncontrolledHazardCount(j),
    hasHigh: hasHighSeverityHazard(j),
  }));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Job Safety Analyses"
          subtitle="Per-shift JSAs. Foreman fills one before crew starts; AI auto-loads typical hazards for the task type from a pre-built template library."
          actions={
            <span className="flex gap-2">
              <StatementCsvButton
                filename="jsas.csv"
                headers={['Date', 'Job', 'Task', 'Foreman', 'Hazards', 'Uncontrolled', 'Crew signed', 'High severity']}
                rows={csvRows}
              />
              <LinkButton href="/jsas/new" variant="primary" size="md">
                + New JSA
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total JSAs" value={jsas.length} />
          <Tile label={`${year} JSAs`} value={thisYear.length} />
          <Tile
            label="With high-severity hazards"
            value={highSeverityCount}
            tone={highSeverityCount > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="With uncontrolled hazards"
            value={uncontrolledCount}
            tone={uncontrolledCount > 0 ? 'warn' : 'success'}
          />
        </section>

        {tableRows.length === 0 ? (
          <EmptyState
            title="No JSAs logged yet"
            body="Foremen fill JSAs at the start of each shift. Add one via + New JSA or from the phone app (mobile coming next)."
          />
        ) : (
          <DataTable
            rows={tableRows}
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (j) => (
                  <Link
                    href={`/jsas/${j.id}`}
                    className="font-mono text-xs text-blue-700 hover:underline"
                  >
                    {j.workDate}
                  </Link>
                ),
              },
              {
                key: 'job',
                header: 'Job',
                cell: (j) => <span className="font-mono text-xs text-gray-700">{j.jobId}</span>,
              },
              {
                key: 'task',
                header: 'Task',
                cell: (j) => <span className="text-sm">{jsaTaskTypeLabel(j.taskType)}</span>,
              },
              {
                key: 'foreman',
                header: 'Foreman',
                cell: (j) => <span className="text-sm text-gray-900">{j.preparedByName}</span>,
              },
              {
                key: 'hazards',
                header: 'Hazards',
                numeric: true,
                cell: (j) => (
                  <span
                    className={
                      j.deficiencyCount > 0
                        ? 'font-semibold text-amber-800'
                        : 'text-gray-700'
                    }
                  >
                    {j.hazards.length}
                    {j.deficiencyCount > 0 ? ` (${j.deficiencyCount} ⚠)` : ''}
                  </span>
                ),
              },
              {
                key: 'crew',
                header: 'Crew signed',
                numeric: true,
                cell: (j) => <span>{j.crewSignatures.length}</span>,
              },
              {
                key: 'severity',
                header: 'Severity',
                cell: (j) =>
                  j.hasHigh ? (
                    <StatusPill label="High / Critical" tone="danger" />
                  ) : (
                    <StatusPill label="OK" tone="success" />
                  ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
