// /equipment-inspections — list view.
//
// Pre-shift / periodic safety inspections of heavy equipment. Backs the
// DOT / Cal-OSHA / YGE Equipment Maintenance Plan paper trail. Out-of-service
// units and inspections with deficiencies float to the top.

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
  equipmentInspectionDeficiencyCount,
  equipmentInspectionHasIssues,
  equipmentInspectionTypeLabel,
  type Equipment,
  type EquipmentInspection,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspections(filter: {
  outOfService?: string;
}): Promise<EquipmentInspection[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/equipment-inspections`);
    if (filter.outOfService) url.searchParams.set('outOfService', filter.outOfService);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { inspections: EquipmentInspection[] }).inspections;
  } catch {
    return [];
  }
}

async function fetchAll(): Promise<EquipmentInspection[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment-inspections`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { inspections: EquipmentInspection[] }).inspections;
  } catch {
    return [];
  }
}

async function fetchEquipment(): Promise<Equipment[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { equipment: Equipment[] }).equipment;
  } catch {
    return [];
  }
}

export default async function EquipmentInspectionsPage({
  searchParams,
}: {
  searchParams: { outOfService?: string };
}) {
  requirePermission('safety:view');

  const [inspections, all, equipment] = await Promise.all([
    fetchInspections(searchParams),
    fetchAll(),
    fetchEquipment(),
  ]);

  const eqNameById = new Map<string, string>(equipment.map((e) => [e.id, e.name]));
  const outOfServiceCount = all.filter((i) => i.outOfService).length;
  const withIssuesCount = all.filter((i) => equipmentInspectionHasIssues(i)).length;
  const equipmentUnits = new Set(all.map((i) => i.equipmentId)).size;

  const tableRows = inspections.map((i) => ({
    ...i,
    equipmentName: eqNameById.get(i.equipmentId) ?? i.equipmentId,
    deficiencies: equipmentInspectionDeficiencyCount(i),
  }));

  const csvRows: Array<Array<string | number>> = all.map((i) => [
    i.inspectedOn,
    eqNameById.get(i.equipmentId) ?? i.equipmentId,
    equipmentInspectionTypeLabel(i.type),
    i.inspectorName,
    equipmentInspectionDeficiencyCount(i),
    i.outOfService ? 'OUT_OF_SERVICE' : 'OK',
  ]);

  function buildHref(state: 'all' | 'true' | 'false'): string {
    return state === 'all'
      ? '/equipment-inspections'
      : `/equipment-inspections?outOfService=${state}`;
  }
  const active: 'all' | 'true' | 'false' =
    searchParams.outOfService === 'true' || searchParams.outOfService === 'false'
      ? searchParams.outOfService
      : 'all';

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Equipment inspections"
          subtitle="Pre-shift and periodic safety inspections of heavy equipment. Out-of-service units and inspections with deficiencies float to the top."
          actions={
            <span className="flex gap-2">
              <StatementCsvButton
                filename="equipment-inspections.csv"
                headers={['Date', 'Equipment', 'Type', 'Inspector', 'Deficiencies', 'Status']}
                rows={csvRows}
              />
              <LinkButton href="/equipment-inspections/new" variant="primary" size="md">
                + New inspection
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total inspections" value={all.length} />
          <Tile
            label="Out of service"
            value={outOfServiceCount}
            tone={outOfServiceCount > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="With issues"
            value={withIssuesCount}
            tone={withIssuesCount > 0 ? 'warn' : 'success'}
          />
          <Tile label="Equipment units" value={equipmentUnits} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Filter</span>
          {(['all', 'true', 'false'] as const).map((k) => {
            const label = k === 'all' ? 'All' : k === 'true' ? 'Out of service' : 'In service';
            const isActive = active === k;
            return (
              <Link
                key={k}
                href={buildHref(k)}
                className={`rounded px-2 py-1 text-xs ${isActive ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                {label}
              </Link>
            );
          })}
        </section>

        {tableRows.length === 0 ? (
          <EmptyState
            title="No inspections logged"
            body="Equipment inspections show up here. Click + New inspection to log one."
          />
        ) : (
          <DataTable
            rows={tableRows}
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (r) => (
                  <span className="font-mono text-xs text-gray-700">{r.inspectedOn}</span>
                ),
              },
              {
                key: 'equipment',
                header: 'Equipment',
                cell: (r) => (
                  <Link
                    href={`/equipment-inspections/${r.id}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {r.equipmentName}
                  </Link>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                cell: (r) => (
                  <span className="text-xs text-gray-700">
                    {equipmentInspectionTypeLabel(r.type)}
                  </span>
                ),
              },
              {
                key: 'inspector',
                header: 'Inspector',
                cell: (r) => <span className="text-sm text-gray-900">{r.inspectorName}</span>,
              },
              {
                key: 'deficiencies',
                header: 'Deficiencies',
                numeric: true,
                cell: (r) => (
                  <span
                    className={
                      r.deficiencies > 0 ? 'font-semibold text-amber-800' : 'text-gray-500'
                    }
                  >
                    {r.deficiencies}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (r) =>
                  r.outOfService ? (
                    <StatusPill label="Out of service" tone="danger" />
                  ) : equipmentInspectionHasIssues(r) ? (
                    <StatusPill label="Needs attention" tone="warn" />
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
