import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { StatementCsvButton } from '../../components/statement-csv-button';
import { requirePermission } from '../../lib/permissions';
import {
  serviceRecordCategoryLabel,
  serviceRecordPriorityLabel,
  totalRepairCostCents,
  type EquipmentServiceRecord,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchRecords(): Promise<EquipmentServiceRecord[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment-service-records`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { records: EquipmentServiceRecord[] }).records;
  } catch {
    return [];
  }
}

export default async function ServiceRecordsPage() {
  requirePermission('safety:view');
  const records = await fetchRecords();
  const open = records.filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS').length;
  const redTagged = records.filter((r) => r.redTagged && (r.status === 'OPEN' || r.status === 'IN_PROGRESS')).length;
  const totalCost = records.reduce((s, r) => s + totalRepairCostCents(r), 0);

  const csvRows: Array<Array<string | number>> = records.map((r) => [
    r.openedOn,
    r.equipmentId,
    r.status,
    r.priority,
    serviceRecordCategoryLabel(r.category),
    r.requestedByName,
    r.description.slice(0, 200),
    (totalRepairCostCents(r) / 100).toFixed(2),
    r.redTagged ? 'Y' : 'N',
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Equipment service"
          subtitle="Work orders for equipment service + repair. SAFETY-CRITICAL items red-tag the machine until closed."
          actions={
            <span className="flex gap-2">
              <StatementCsvButton
                filename="equipment-service-records.csv"
                headers={['Opened', 'Equipment', 'Status', 'Priority', 'Category', 'Foreman', 'Description', 'Cost', 'Red-tagged']}
                rows={csvRows}
              />
              <LinkButton href="/equipment-service-records/new" variant="primary" size="md">
                + New work order
              </LinkButton>
            </span>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total work orders" value={records.length} />
          <Tile label="Open" value={open} tone={open > 0 ? 'warn' : 'success'} />
          <Tile label="Red-tagged" value={redTagged} tone={redTagged > 0 ? 'warn' : 'success'} />
          <Tile label="Repair cost (lifetime)" value={<Money cents={totalCost} />} />
        </section>

        {records.length === 0 ? (
          <EmptyState
            title="No work orders yet"
            body="When equipment fails an inspection or a mechanic logs a repair, work orders show up here."
          />
        ) : (
          <DataTable
            rows={records}
            columns={[
              {
                key: 'opened',
                header: 'Opened',
                cell: (r) => (
                  <Link href={`/equipment-service-records/${r.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {r.openedOn}
                  </Link>
                ),
              },
              {
                key: 'equipment',
                header: 'Equipment',
                cell: (r) => <span className="font-mono text-xs text-gray-700">{r.equipmentId}</span>,
              },
              {
                key: 'description',
                header: 'Description',
                cell: (r) => <span className="line-clamp-2 text-sm text-gray-900">{r.description}</span>,
              },
              {
                key: 'priority',
                header: 'Priority',
                cell: (r) =>
                  r.priority === 'SAFETY_CRITICAL' ? (
                    <StatusPill label="Safety critical" tone="danger" />
                  ) : r.priority === 'HIGH' ? (
                    <StatusPill label="High" tone="warn" />
                  ) : (
                    <span className="text-xs text-gray-600">{serviceRecordPriorityLabel(r.priority)}</span>
                  ),
              },
              {
                key: 'category',
                header: 'Category',
                cell: (r) => <span className="text-xs text-gray-700">{serviceRecordCategoryLabel(r.category)}</span>,
              },
              {
                key: 'cost',
                header: 'Cost',
                numeric: true,
                cell: (r) => <Money cents={totalRepairCostCents(r)} />,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (r) =>
                  r.status === 'CLOSED' ? (
                    <StatusPill label="Closed" tone="success" />
                  ) : r.redTagged ? (
                    <StatusPill label="🚫 Red-tagged" tone="danger" />
                  ) : r.status === 'IN_PROGRESS' ? (
                    <StatusPill label="In progress" tone="warn" />
                  ) : (
                    <StatusPill label="Open" tone="warn" />
                  ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
