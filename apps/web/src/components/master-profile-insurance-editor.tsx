// Master-profile insurance policies editor.
//
// Client island. Same list-of-rows pattern as the officers editor.
// Each row is one policy (GL / auto / WC / umbrella / etc.) with
// carrier + policy # + dates + limits + broker + ACORD-on-file
// flag.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  newInsurancePolicyId,
  type MasterProfile,
  type MasterProfileInsurancePolicy,
} from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  initial: MasterProfileInsurancePolicy[];
}

const KIND_OPTIONS: Array<{ value: MasterProfileInsurancePolicy['kind']; label: string }> = [
  { value: 'GENERAL_LIABILITY', label: 'General liability' },
  { value: 'AUTOMOBILE_LIABILITY', label: 'Auto' },
  { value: 'WORKERS_COMP', label: 'Workers comp' },
  { value: 'EXCESS_UMBRELLA', label: 'Excess / umbrella' },
  { value: 'POLLUTION', label: 'Pollution' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'EQUIPMENT_FLOATER', label: 'Equipment floater' },
  { value: 'BUILDERS_RISK', label: 'Builders risk' },
  { value: 'OTHER', label: 'Other' },
];

export function MasterProfileInsuranceEditor({ apiBaseUrl, initial }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<MasterProfileInsurancePolicy[]>(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function setRow(index: number, patch: Partial<MasterProfileInsurancePolicy>) {
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setDraft((rows) => rows.filter((_, i) => i !== index));
  }

  function addRow() {
    setDraft((rows) => [
      ...rows,
      {
        id: newInsurancePolicyId(),
        kind: 'GENERAL_LIABILITY',
        carrierName: '',
        policyNumber: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        perOccurrenceCents: 0,
        aggregateCents: 0,
        acordCertOnFile: false,
      },
    ]);
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      const patch: Partial<MasterProfile> = { insurance: draft };
      const res = await fetch(`${apiBaseUrl}/api/master-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: unknown };
        const issuesSuffix = body.issues
          ? ` — ${JSON.stringify(body.issues).slice(0, 200)}`
          : '';
        setError((body.error ?? `API returned ${res.status}`) + issuesSuffix);
        return;
      }
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Insurance policies ({draft.length})
        </h2>
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-yge-blue-500 px-2 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          + Add policy
        </button>
      </header>

      {draft.length === 0 ? (
        <p className="text-sm text-gray-500">
          No policies recorded. Add at least the active GL + WC for the
          ACORD 25 generator to fill those rows automatically.
        </p>
      ) : (
        <div className="space-y-3">
          {draft.map((p, i) => (
            <div key={p.id} className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Kind">
                  <select
                    value={p.kind}
                    onChange={(e) =>
                      setRow(i, { kind: e.target.value as MasterProfileInsurancePolicy['kind'] })
                    }
                    className={inputClass}
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Carrier">
                  <input
                    type="text"
                    value={p.carrierName}
                    onChange={(e) => setRow(i, { carrierName: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Policy #">
                  <input
                    type="text"
                    value={p.policyNumber}
                    onChange={(e) => setRow(i, { policyNumber: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Effective">
                  <input
                    type="date"
                    value={p.effectiveDate}
                    onChange={(e) => setRow(i, { effectiveDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Expires">
                  <input
                    type="date"
                    value={p.expiresOn}
                    onChange={(e) => setRow(i, { expiresOn: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Per-occurrence ($)">
                  <input
                    type="number"
                    min={0}
                    value={p.perOccurrenceCents / 100}
                    onChange={(e) =>
                      setRow(i, { perOccurrenceCents: Math.round(Number(e.target.value) * 100) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Aggregate ($)">
                  <input
                    type="number"
                    min={0}
                    value={p.aggregateCents / 100}
                    onChange={(e) =>
                      setRow(i, { aggregateCents: Math.round(Number(e.target.value) * 100) })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Broker name">
                  <input
                    type="text"
                    value={p.brokerName ?? ''}
                    onChange={(e) => setRow(i, { brokerName: e.target.value || undefined })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Broker phone">
                  <input
                    type="tel"
                    value={p.brokerPhone ?? ''}
                    onChange={(e) => setRow(i, { brokerPhone: e.target.value || undefined })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Broker email">
                  <input
                    type="email"
                    value={p.brokerEmail ?? ''}
                    onChange={(e) => setRow(i, { brokerEmail: e.target.value || undefined })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={p.acordCertOnFile}
                    onChange={(e) => setRow(i, { acordCertOnFile: e.target.checked })}
                  />
                  <span>ACORD 25 cert on file with most agencies</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="rounded bg-yge-blue-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save policies'}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-700">
            ✓ Saved at {savedAt.replace('T', ' ').slice(0, 16)} UTC
          </span>
        )}
        {dirty && !busy && !savedAt && (
          <span className="text-xs text-gray-500">Unsaved changes.</span>
        )}
      </div>
    </section>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
