'use client';

// /employees/new — create an employee.
//
// Plain English: the form behind the "Add employee" button on the
// roster page. POSTs to /api/employees with name + role +
// classification + contact info + optional foreman link, then
// redirects to /employees on success.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CertificationKind,
  DirClassification,
  Employee,
  EmployeeRole,
  EmploymentStatus,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../../components';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ROLES: EmployeeRole[] = [
  'OWNER',
  'OFFICE',
  'PROJECT_MANAGER',
  'SUPERINTENDENT',
  'FOREMAN',
  'OPERATOR',
  'TRUCK_DRIVER',
  'LABORER',
  'MECHANIC',
  'APPRENTICE',
  'OTHER',
];

const CLASSIFICATIONS: DirClassification[] = [
  'NOT_APPLICABLE',
  'OPERATING_ENGINEER_GROUP_1',
  'OPERATING_ENGINEER_GROUP_2',
  'OPERATING_ENGINEER_GROUP_3',
  'OPERATING_ENGINEER_GROUP_4',
  'OPERATING_ENGINEER_GROUP_5',
  'TEAMSTER_GROUP_1',
  'TEAMSTER_GROUP_2',
  'LABORER_GROUP_1',
  'LABORER_GROUP_2',
  'LABORER_GROUP_3',
  'CARPENTER',
  'CEMENT_MASON',
  'IRONWORKER',
  'OTHER',
];

const STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'LAID_OFF', 'TERMINATED'];

// Roles that can supervise others on YGE's org chart. Determines who shows
// up in the "Reports to" dropdown on the new-employee form. Crew roles
// (laborer, operator, driver, apprentice) are excluded — they don't supervise.
const SUPERVISOR_ROLES: EmployeeRole[] = [
  'OWNER',
  'OFFICE',
  'PROJECT_MANAGER',
  'SUPERINTENDENT',
  'FOREMAN',
];

const CERT_KINDS: CertificationKind[] = [
  'CDL_A',
  'CDL_B',
  'OSHA_10',
  'OSHA_30',
  'FIRST_AID_CPR',
  'FORKLIFT',
  'TRAFFIC_CONTROL',
  'CONFINED_SPACE',
  'CRANE_OPERATOR',
  'HAZWOPER',
  'OTHER',
];

function certKindLabel(k: CertificationKind): string {
  switch (k) {
    case 'CDL_A':
      return 'CDL Class A';
    case 'CDL_B':
      return 'CDL Class B';
    case 'OSHA_10':
      return 'OSHA 10';
    case 'OSHA_30':
      return 'OSHA 30';
    case 'FIRST_AID_CPR':
      return 'First Aid / CPR';
    case 'FORKLIFT':
      return 'Forklift';
    case 'TRAFFIC_CONTROL':
      return 'Traffic Control';
    case 'CONFINED_SPACE':
      return 'Confined Space';
    case 'CRANE_OPERATOR':
      return 'Crane Operator';
    case 'HAZWOPER':
      return 'HAZWOPER';
    case 'OTHER':
      return 'Other';
  }
}

interface CertRow {
  kind: CertificationKind;
  label: string;
  expiresOn: string;
  issuer: string;
}

function roleLabel(r: EmployeeRole): string {
  return r
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function classificationLabel(c: DirClassification): string {
  if (c === 'NOT_APPLICABLE') return 'Not applicable (private work / office)';
  return c
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EmployeeRole>('LABORER');
  const [classification, setClassification] =
    useState<DirClassification>('NOT_APPLICABLE');
  const [classificationNote, setClassificationNote] = useState('');
  const [foremanId, setForemanId] = useState('');
  const [hiredOn, setHiredOn] = useState('');
  const [status, setStatus] = useState<EmploymentStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull active supervisors (owner/office/PM/super/foreman) for the
  // "Reports to" dropdown. Crew roles can't supervise so they're filtered out.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { employees: Employee[] };
        if (cancelled) return;
        const f = json.employees.filter(
          (e) => e.status === 'ACTIVE' && SUPERVISOR_ROLES.includes(e.role),
        );
        setSupervisors(f);
      } catch {
        // skip — non-blocking
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function addCert() {
    setCerts((prev) => [
      ...prev,
      { kind: 'CDL_A', label: '', expiresOn: '', issuer: '' },
    ]);
  }

  function removeCert(idx: number) {
    setCerts((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCert(idx: number, patch: Partial<CertRow>) {
    setCerts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      classification,
      status,
    };
    if (displayName.trim()) body.displayName = displayName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (email.trim()) body.email = email.trim();
    if (classification === 'OTHER' && classificationNote.trim()) {
      body.classificationNote = classificationNote.trim();
    }
    if (foremanId) body.foremanId = foremanId;
    if (hiredOn) body.hiredOn = hiredOn;
    if (notes.trim()) body.notes = notes.trim();
    // Drop empty cert rows; keep ones with at least a label so the row is
    // useful when displayed back on the detail page.
    const validCerts = certs
      .filter((c) => c.label.trim().length > 0)
      .map((c) => {
        const cert: Record<string, unknown> = {
          kind: c.kind,
          label: c.label.trim(),
        };
        if (c.expiresOn) cert.expiresOn = c.expiresOn;
        if (c.issuer.trim()) cert.issuer = c.issuer.trim();
        return cert;
      });
    if (validCerts.length > 0) body.certifications = validCerts;
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { employee: Employee };
      router.push(`/employees/${json.employee.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <div className="mb-2 text-xs">
          <Link href="/employees" className="text-blue-700 hover:underline">
            ← Back to employees
          </Link>
        </div>
        <PageHeader title="Add employee" subtitle="Phase 1 roster fields. Pay rate + W-4 land in payroll module." />

        <form onSubmit={submit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Last name" required>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Display name (optional)">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='Preferred / nickname (e.g. "Skip" instead of "Hubert")'
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="707-555-0123"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" required>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as EmployeeRole)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" required>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmploymentStatus)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="DIR classification (for prevailing wage)">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as DirClassification)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {classificationLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          {classification === 'OTHER' && (
            <Field label="Classification note">
              <input
                value={classificationNote}
                onChange={(e) => setClassificationNote(e.target.value)}
                placeholder="Free-form override"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          )}

          <Field label="Reports to (supervisor / foreman)">
            <select
              value={foremanId}
              onChange={(e) => setForemanId(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="">— None —</option>
              {supervisors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.firstName} {f.lastName} ({roleLabel(f.role)})
                </option>
              ))}
            </select>
            {supervisors.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                No supervisors on file yet. Leave blank for owners and first hires; you can update this later from the employee detail page.
              </p>
            )}
          </Field>

          <Field label="Hire date">
            <input
              type="date"
              value={hiredOn}
              onChange={(e) => setHiredOn(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          {/* Certifications — CDL, OSHA, traffic control, etc. Optional;
              foreman can add more from the employee detail page later. */}
          <div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Certifications
              </h3>
              <button
                type="button"
                onClick={addCert}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                + Add certification
              </button>
            </div>
            {certs.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">
                CDL, OSHA, traffic control, etc. Optional — add now or from the
                employee detail page later.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {certs.map((c, idx) => (
                  <li
                    key={idx}
                    className="rounded border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Kind" required>
                        <select
                          value={c.kind}
                          onChange={(e) =>
                            updateCert(idx, {
                              kind: e.target.value as CertificationKind,
                            })
                          }
                          className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        >
                          {CERT_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {certKindLabel(k)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Label" required>
                        <input
                          value={c.label}
                          onChange={(e) =>
                            updateCert(idx, { label: e.target.value })
                          }
                          placeholder='e.g. "CDL Class A"'
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </Field>
                      <Field label="Expires (optional)">
                        <input
                          type="date"
                          value={c.expiresOn}
                          onChange={(e) =>
                            updateCert(idx, { expiresOn: e.target.value })
                          }
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </Field>
                      <Field label="Issuer (optional)">
                        <input
                          value={c.issuer}
                          onChange={(e) =>
                            updateCert(idx, { issuer: e.target.value })
                          }
                          placeholder="DMV / OSHA / ATSSA / county"
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                        />
                      </Field>
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeCert(idx)}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Link
              href="/employees"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Add employee'}
            </button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-700">*</span>}
      </span>
      {children}
    </label>
  );
}
