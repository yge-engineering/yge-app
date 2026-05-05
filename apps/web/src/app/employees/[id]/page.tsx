// /employees/[id] — employee detail.
//
// Plain English: shows everything we know about one person on the
// roster — contact info, role, classification, who they report to,
// hire date, certifications, internal notes. The list page links
// here, and the "Add employee" form redirects here after save.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  certExpiryStatus,
  classificationLabel,
  employmentStatusLabel,
  fullName,
  roleLabel,
  type Employee,
} from '@yge/shared';

import {
  AppShell,
  Avatar,
  DescriptionList,
  EmployeeDeleteButton,
  EmployeeStatusEditor,
  PageHeader,
  RoleBadge,
  StatusPill,
} from '../../../components';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEmployee(id: string): Promise<Employee | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/employees/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as { employee?: Employee };
    return json.employee ?? null;
  } catch {
    return null;
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { employees?: Employee[] };
    return body.employees ?? [];
  } catch {
    return [];
  }
}

function statusTone(s: string): 'success' | 'warn' | 'muted' | 'neutral' {
  switch (s) {
    case 'ACTIVE':
      return 'success';
    case 'ON_LEAVE':
      return 'warn';
    case 'TERMINATED':
    case 'LAID_OFF':
      return 'muted';
    default:
      return 'neutral';
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const employee = await fetchEmployee(params.id);
  if (!employee) notFound();

  // Resolve foreman name (employee.foremanId points at another Employee.id).
  let foremanName: string | null = null;
  if (employee.foremanId) {
    const all = await fetchEmployees();
    const f = all.find((e) => e.id === employee.foremanId);
    if (f) foremanName = `${f.firstName} ${f.lastName}`;
  }

  const displayName = fullName(employee);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-2 text-xs">
          <Link href="/employees" className="text-blue-700 hover:underline">
            ← Back to employees
          </Link>
        </div>

        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <Avatar name={displayName} size="md" />
              <span>{displayName}</span>
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <RoleBadge role={employee.role} />
              <StatusPill
                label={employmentStatusLabel(employee.status)}
                tone={statusTone(employee.status)}
              />
              <span className="text-xs text-gray-500">
                {classificationLabel(employee.classification)}
              </span>
            </span>
          }
          actions={
            <EmployeeStatusEditor
              employee={employee}
              apiBaseUrl={publicApiBaseUrl()}
            />
          }
        />

        <DescriptionList
          items={[
            { label: 'First name', value: employee.firstName },
            { label: 'Last name', value: employee.lastName },
            ...(employee.displayName
              ? [{ label: 'Display name', value: employee.displayName }]
              : []),
            {
              label: 'Phone',
              value: employee.phone ? (
                <a
                  href={`tel:${employee.phone.replace(/[^\d+]/g, '')}`}
                  className="text-blue-700 hover:underline"
                >
                  {employee.phone}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              ),
            },
            {
              label: 'Email',
              value: employee.email ? (
                <a
                  href={`mailto:${employee.email}`}
                  className="text-blue-700 hover:underline"
                >
                  {employee.email}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              ),
            },
            { label: 'Role', value: roleLabel(employee.role) },
            {
              label: 'DIR classification',
              value: classificationLabel(employee.classification),
            },
            ...(employee.classificationNote
              ? [
                  {
                    label: 'Classification note',
                    value: employee.classificationNote,
                  },
                ]
              : []),
            {
              label: 'Reports to',
              value: foremanName ?? <span className="text-gray-400">—</span>,
            },
            {
              label: 'Hire date',
              value: formatDate(employee.hiredOn),
            },
            {
              label: 'Status',
              value: employmentStatusLabel(employee.status),
            },
            {
              label: 'Last updated',
              value: formatWhen(employee.updatedAt),
            },
          ]}
        />

        {/* Certifications */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Certifications</h2>
          {employee.certifications.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No certifications on file. Add CDL, OSHA, traffic-control, etc. as
              they're earned so the roster can flag expiring credentials.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
              {employee.certifications.map((c, idx) => {
                const status = certExpiryStatus(c);
                const tone =
                  status === 'expired'
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : status === 'expiringSoon'
                      ? 'text-yellow-800 bg-yellow-50 border-yellow-200'
                      : 'text-gray-600 bg-gray-50 border-gray-200';
                const note =
                  status === 'expired'
                    ? 'Expired'
                    : status === 'expiringSoon'
                      ? 'Expiring soon'
                      : status === 'lifetime'
                        ? 'No expiry on file'
                        : 'Current';
                return (
                  <li
                    key={`${c.kind}-${idx}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {c.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.kind.replace(/_/g, ' ')}
                        {c.issuer ? ` · ${c.issuer}` : ''}
                        {c.expiresOn ? ` · expires ${formatDate(c.expiresOn)}` : ''}
                      </div>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${tone}`}
                    >
                      {note}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Internal notes */}
        {employee.notes && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-yellow-50 p-4 text-sm text-gray-800">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Notes (internal)
            </div>
            <p className="mt-2 whitespace-pre-wrap">{employee.notes}</p>
          </div>
        )}

        {/* Danger zone */}
        <section className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Danger zone
          </div>
          <p className="mt-1 text-sm text-gray-700">
            Use the Status dropdown above to mark this employee Terminated —
            that keeps payroll and timecard history intact. Only delete the
            record if it was added by mistake.
          </p>
          <div className="mt-3">
            <EmployeeDeleteButton
              employeeId={employee.id}
              name={displayName}
              apiBaseUrl={publicApiBaseUrl()}
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
