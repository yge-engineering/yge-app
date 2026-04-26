// /tools — power tool inventory.
//
// Server component fetches tools + employees so the dispatch dropdown
// inside ToolsRows (a client island) can map assignedToEmployeeId to a
// human name. Each row shows category, name+model+SN, current status,
// and a quick-action menu (assign / return / edit).

import Link from 'next/link';
import {
  categoryLabel,
  fullName,
  toolStatusLabel,
  type Employee,
  type Tool,
} from '@yge/shared';
import { ToolDispatchControls } from '@/components/tool-dispatch-controls';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchTools(): Promise<Tool[]> {
  const res = await fetch(`${apiBaseUrl()}/api/tools`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { tools: Tool[] };
  return json.tools;
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { employees: Employee[] };
  return json.employees;
}

export default async function ToolsPage() {
  const [tools, employees] = await Promise.all([fetchTools(), fetchEmployees()]);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const activeForemen = employees.filter(
    (e) => e.status === 'ACTIVE' && (e.role === 'FOREMAN' || e.role === 'OPERATOR' || e.role === 'TRUCK_DRIVER' || e.role === 'LABORER' || e.role === 'MECHANIC' || e.role === 'APPRENTICE'),
  );

  const assignedCount = tools.filter((t) => t.status === 'ASSIGNED').length;
  const inYardCount = tools.filter((t) => t.status === 'IN_YARD').length;
  const repairCount = tools.filter((t) => t.status === 'OUT_FOR_REPAIR').length;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/crew" className="text-yge-blue-500 hover:underline">
            Crew &rarr;
          </Link>
          <Link
            href="/tools/new"
            className="rounded bg-yge-blue-500 px-3 py-1 font-medium text-white hover:bg-yge-blue-700"
          >
            + Add tool
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Power tools</h1>
      <p className="mt-2 text-gray-700">
        {tools.length} tool{tools.length === 1 ? '' : 's'} on the books &middot;{' '}
        {assignedCount} assigned &middot; {inYardCount} in yard
        {repairCount > 0 && (
          <>
            {' '}&middot;{' '}
            <span className="text-orange-700">{repairCount} out for repair</span>
          </>
        )}
      </p>

      {tools.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No tools yet. Click <em>Add tool</em> to start the inventory.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Tool</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Assigned to</th>
                <th className="px-4 py-2">Dispatch</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tools.map((t) => {
                const assignee = t.assignedToEmployeeId
                  ? empById.get(t.assignedToEmployeeId)
                  : undefined;
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        {[t.make, t.model].filter(Boolean).join(' ')}
                        {t.serialNumber && (
                          <>
                            {(t.make || t.model) ? ' \u00b7 ' : ''}SN {t.serialNumber}
                          </>
                        )}
                        {t.assetTag && (
                          <>
                            {' '}\u00b7 Tag {t.assetTag}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {categoryLabel(t.category)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {assignee ? (
                        <Link
                          href={`/crew/${assignee.id}`}
                          className="text-yge-blue-500 hover:underline"
                        >
                          {fullName(assignee)}
                        </Link>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ToolDispatchControls
                        tool={t}
                        employees={activeForemen}
                        apiBaseUrl={publicApiBaseUrl()}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/tools/${t.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Tool['status'] }) {
  const cls =
    status === 'ASSIGNED'
      ? 'bg-blue-100 text-blue-800'
      : status === 'IN_YARD'
        ? 'bg-green-100 text-green-800'
        : status === 'IN_SHOP'
          ? 'bg-gray-100 text-gray-700'
          : status === 'OUT_FOR_REPAIR'
            ? 'bg-orange-100 text-orange-800'
            : status === 'LOST'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-200 text-gray-600';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {toolStatusLabel(status)}
    </span>
  );
}
