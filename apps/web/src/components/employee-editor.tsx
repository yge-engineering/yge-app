'use client';

// Employee editor — client island for /crew/[id]. Handles inline patches
// against PATCH /api/employees/:id, manages the certs array, and lets the
// estimator change the foreman / status / classification.

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  certKindLabel,
  classificationLabel,
  employmentStatusLabel,
  fullName,
  roleLabel,
  type CertificationKind,
  type DirClassification,
  type Employee,
  type EmployeeCertification,
  type EmployeeRole,
  type EmploymentStatus,
} from '@yge/shared';

const ROLES: EmployeeRole[] = [
  'FOREMAN',
  'OPERATOR',
  'TRUCK_DRIVER',
  'LABORER',
  'MECHANIC',
  'APPRENTICE',
  'SUPERINTENDENT',
  'PROJECT_MANAGER',
  'OFFICE',
  'OWNER',
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

interface Props {
  initial: Employee;
  foremen: Employee[];
  apiBaseUrl: string;
}

export function EmployeeEditor({ initial, foremen, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [emp, setEmp] = useState<Employee>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local form fields (mirrors emp but easier to bind to inputs).
  const [phone, setPhone] = useState(emp.phone ?? '');
  const [email, setEmail] = useState(emp.email ?? '');
  const [displayName, setDisplayName] = useState(emp.displayName ?? '');
  const [hiredOn, setHiredOn] = useState(emp.hiredOn ?? '');
  const [notes, setNotes] = useState(emp.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }
      const json = (await res.json()) as { employee: Employee };
      setEmp(json.employee);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function saveBasics() {
    void patch({
      displayName: displayName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      hiredOn: hiredOn.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  function addCert() {
    const next: EmployeeCertification = {
      kind: 'OSHA_10',
      label: 'OSHA 10',
    };
    void patch({ certifications: [...emp.certifications, next] });
  }

  function removeCert(i: number) {
    const next = emp.certifications.filter((_, idx) => idx !== i);
    void patch({ certifications: next });
  }

  function updateCert(i: number, partial: Partial<EmployeeCertification>) {
    const next = emp.certifications.map((c, idx) =>
      idx === i ? { ...c, ...partial } : c,
    );
    void patch({ certifications: next });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yge-blue-500">{fullName(emp)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {roleLabel(emp.role)} &middot; {classificationLabel(emp.classification)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={emp.status}
            onChange={(e) =>
              void patch({ status: e.target.value as EmploymentStatus })
            }
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {employmentStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('employeeEditor.saving')}</span>}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Role + classification + foreman */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('employeeEditor.lblRole')}>
          <select
            value={emp.role}
            onChange={(e) => void patch({ role: e.target.value as EmployeeRole })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('employeeEditor.lblClassification')}>
          <select
            value={emp.classification}
            onChange={(e) =>
              void patch({ classification: e.target.value as DirClassification })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {classificationLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('employeeEditor.lblForeman')}>
          <select
            value={emp.foremanId ?? ''}
            onChange={(e) => void patch({ foremanId: e.target.value || undefined })}
            disabled={emp.role === 'FOREMAN'}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">{t('employeeEditor.foremanNone')}</option>
            {foremen.map((f) => (
              <option key={f.id} value={f.id}>
                {fullName(f)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('employeeEditor.lblHired')}>
          <input
            type="date"
            value={hiredOn}
            onChange={(e) => setHiredOn(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Contact */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('employeeEditor.lblDisplay')}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('employeeEditor.lblPhone')}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('employeeEditor.lblEmail')}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Certifications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('employeeEditor.certsHeader')}</h2>
          <button
            type="button"
            onClick={addCert}
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            {t('employeeEditor.addCert')}
          </button>
        </div>
        {emp.certifications.length === 0 ? (
          <p className="text-sm text-gray-500">{t('employeeEditor.certsEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {emp.certifications.map((c, i) => (
              <li
                key={i}
                className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-gray-50 p-3"
              >
                <Field label={t('employeeEditor.lblCertType')}>
                  <select
                    value={c.kind}
                    onChange={(e) =>
                      updateCert(i, {
                        kind: e.target.value as CertificationKind,
                        label: certKindLabel(e.target.value as CertificationKind),
                      })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {CERT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {certKindLabel(k)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('employeeEditor.lblCertLabel')}>
                  <input
                    value={c.label}
                    onChange={(e) => updateCert(i, { label: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <Field label={t('employeeEditor.lblCertExpires')}>
                  <input
                    type="date"
                    value={c.expiresOn ?? ''}
                    onChange={(e) =>
                      updateCert(i, { expiresOn: e.target.value || undefined })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <Field label={t('employeeEditor.lblCertIssuer')}>
                  <input
                    value={c.issuer ?? ''}
                    onChange={(e) =>
                      updateCert(i, { issuer: e.target.value || undefined })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeCert(i)}
                  className="ml-auto text-sm text-red-600 hover:underline"
                >
                  {t('employeeEditor.removeCert')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section>
        <Field label={t('employeeEditor.lblNotes')}>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
